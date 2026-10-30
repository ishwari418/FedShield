import time

from fastapi.testclient import TestClient

from backend import main
from backend.services import training_service as service_module
from backend.services.training_service import TrainingService
from backend.storage.json_storage import read_json, write_json


def test_health_clients_and_privacy_are_explicit():
    with TestClient(main.app) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        clients = client.get("/api/clients").json()
        assert [item["id"] for item in clients] == [
            "hospital-a", "hospital-b", "hospital-c"
        ]
        assert all(item["raw_records_exposed"] is False for item in clients)
        privacy = client.get("/api/privacy/status").json()
        assert privacy["individual_updates_protected"] is False
        assert privacy["flower_secagg_plus_active"] is False
        dashboard = client.get("/api/dashboard").json()
        assert dashboard["total_clients"] == 3
        assert dashboard["total_training_samples"] == 100_000
        assert dashboard["test_samples"] == 20_000
        assert dashboard["privacy"]["test_data_separate"] is True
        assert dashboard["privacy"]["individual_updates_protected"] is False
        csv_report = client.get("/api/reports/export?format=csv")
        pdf_report = client.get("/api/reports/export?format=pdf")
        assert csv_report.text.startswith("round,timestamp")
        assert pdf_report.content.startswith(b"%PDF-")


def test_json_storage_round_trip_and_atomic_replace(tmp_path):
    path = tmp_path / "nested" / "state.json"
    write_json(path, {"round": 2, "metrics": [0.2, 0.7]})
    assert read_json(path, {}) == {"round": 2, "metrics": [0.2, 0.7]}


def test_one_round_training_completes_and_persists(tmp_path, monkeypatch):
    monkeypatch.setattr(service_module, "HISTORY_PATH", tmp_path / "history.json")
    monkeypatch.setattr(service_module, "ACTIVITY_PATH", tmp_path / "activity.json")
    monkeypatch.setattr(service_module, "METRICS_PATH", tmp_path / "metrics.json")
    trainer = TrainingService()
    trainer.start(rounds=1, epochs=1, learning_rate=0.05, batch_size=256)
    deadline = time.monotonic() + 30
    while trainer.status()["state"] == "running" and time.monotonic() < deadline:
        time.sleep(0.05)
    assert trainer.status()["state"] == "completed"
    assert len(trainer.history()) == 1
    assert trainer.history()[0]["clients_participated"] == 3
