import csv
import io
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.config import CLIENTS, STORAGE_DIR
from backend.federated.dataset import client_sample_counts
from backend.services.training_service import TrainingService, training_service


class TrainingRequest(BaseModel):
    rounds: int = Field(default=5, ge=1, le=50)
    local_epochs: int = Field(default=1, ge=1, le=10)
    learning_rate: float = Field(default=0.05, gt=0, le=1)
    batch_size: int = Field(default=256, ge=1, le=512)


@asynccontextmanager
async def lifespan(_: FastAPI):
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="FedShield API",
    description="Local federated-learning demo with explicit privacy status.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _service_error(exc: Exception, status_code: int = 409) -> HTTPException:
    return HTTPException(status_code=status_code, detail=str(exc))


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "FedShield API"}


@app.get("/api/dashboard")
def dashboard() -> dict:
    try:
        return training_service.dashboard()
    except (OSError, ValueError) as exc:
        raise _service_error(exc, 500) from exc


@app.get("/api/clients")
def clients() -> list[dict]:
    try:
        counts = client_sample_counts()
        return [
            {
                **client,
                "samples": counts[client["id"]],
                "status": training_service.status()["client_status"][client["id"]],
                "dataset_path": f"data/clients/{client['id']}/records.csv",
                "raw_records_exposed": False,
            }
            for client in CLIENTS
        ]
    except (OSError, ValueError) as exc:
        raise _service_error(exc, 500) from exc


@app.get("/api/clients/{client_id}")
def client_detail(client_id: str) -> dict:
    client = next((entry for entry in CLIENTS if entry["id"] == client_id), None)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found.")
    counts = client_sample_counts()
    return {
        **client,
        "samples": counts[client_id],
        "status": training_service.status()["client_status"][client_id],
        "raw_records_exposed": False,
        "dataset_distribution": "Synthetic binary classification; aggregate label counts only",
    }


@app.post("/api/training/start")
def start_training(request: TrainingRequest) -> dict:
    try:
        return training_service.start(
            request.rounds,
            request.local_epochs,
            request.learning_rate,
            request.batch_size,
        )
    except RuntimeError as exc:
        raise _service_error(exc) from exc


@app.post("/api/training/stop")
def stop_training() -> dict:
    try:
        return training_service.stop()
    except RuntimeError as exc:
        raise _service_error(exc) from exc


@app.get("/api/training/status")
def training_status() -> dict:
    return training_service.status()


@app.get("/api/training/history")
def training_history() -> list[dict]:
    try:
        return training_service.history()
    except (OSError, ValueError) as exc:
        raise _service_error(exc, 500) from exc


@app.get("/api/analytics")
def analytics() -> dict:
    history = training_service.history()
    return {
        "rounds": history,
        "latest": history[-1] if history else None,
        "client_sample_counts": client_sample_counts(),
        "evaluation_dataset": "Independent synthetic test CSV; not used in local training",
    }


@app.get("/api/privacy/status")
def privacy_status() -> dict:
    return {
        "raw_records_sent_to_api": False,
        "datasets_stay_in_client_folders": True,
        "test_data_separate_from_client_training": True,
        "individual_updates_protected": False,
        "flower_secagg_plus_active": False,
        "secure_aggregation_status": "not_configured",
        "checks": [
            {"label": "Client records are not exposed by REST endpoints", "verified": True},
            {"label": "Global test data is separate from training partitions", "verified": True},
            {"label": "Individual updates are cryptographically protected", "verified": False},
            {"label": "Flower SecAgg+ protocol ran successfully", "verified": False},
        ],
        "limitations": [
            "Clients are simulated in one local Python service, not isolated organizations.",
            "Ordinary FedAvg sends individual updates to the aggregator.",
            "No differential privacy is applied.",
        ],
        "definitions": {
            "data_privacy": "Keeping the original training records local to a client.",
            "secure_aggregation": "A cryptographic protocol that reveals only the sum/average of client updates.",
            "differential_privacy": "A separate mechanism that adds calibrated noise to bound the influence of a record.",
        },
    }


@app.get("/api/reports/export")
def export_report(format: Literal["csv", "pdf"] = Query(default="csv")) -> Response:
    history = training_service.history()
    if format == "csv":
        stream = io.StringIO(newline="")
        fields = [
            "round", "timestamp", "clients_participated", "accuracy", "precision",
            "recall", "f1", "loss", "local_loss", "aggregation",
        ]
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(history)
        return Response(
            stream.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="fedshield-report.csv"'},
        )
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise _service_error(exc, 503) from exc
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=letter)
    pdf.setTitle("FedShield Training Report")
    pdf.drawString(48, 750, "FedShield Training Report")
    pdf.drawString(48, 730, f"Clients: {len(CLIENTS)} | Completed rounds: {len(history)}")
    pdf.drawString(48, 710, "Aggregation: ordinary FedAvg; Flower SecAgg+ is not enabled")
    y = 680
    for row in history[-25:]:
        line = (
            f"Round {row['round']}: accuracy {row['accuracy']:.3f}, "
            f"loss {row['loss']:.3f}, clients {row['clients_participated']}"
        )
        pdf.drawString(48, y, line)
        y -= 18
        if y < 48:
            pdf.showPage()
            y = 750
    pdf.save()
    return Response(
        output.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="fedshield-report.pdf"'},
    )
