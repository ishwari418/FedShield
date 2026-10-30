import threading
from datetime import datetime, timezone

from backend.config import (
    CLIENTS,
    HOLDOUT_FRACTION,
    STORAGE_DIR,
    TRAINING_SAMPLES,
)
from backend.federated.dataset import (
    client_sample_counts,
    ensure_datasets,
    load_client_data,
    load_test_data,
)
from backend.federated.model import BinaryClassifier, evaluate, fedavg, get_parameters, train_local
from backend.storage.json_storage import read_json, write_json

HISTORY_PATH = STORAGE_DIR / "training_history.json"
ACTIVITY_PATH = STORAGE_DIR / "activity_logs.json"
METRICS_PATH = STORAGE_DIR / "metrics.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TrainingService:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._stop_requested = threading.Event()
        self._worker: threading.Thread | None = None
        self._status: dict = self._idle_status()
        if ensure_datasets():
            write_json(HISTORY_PATH, [])
            write_json(METRICS_PATH, {})
            write_json(ACTIVITY_PATH, [])
            self._record_activity(
                f"Generated {TRAINING_SAMPLES:,} training samples and "
                f"{round(TRAINING_SAMPLES * HOLDOUT_FRACTION):,} independent test samples",
                "info",
            )

    @staticmethod
    def _idle_status() -> dict:
        return {
            "state": "idle",
            "current_round": 0,
            "total_rounds": 0,
            "progress": 0,
            "started_at": None,
            "updated_at": None,
            "message": "Ready to train",
            "client_status": {client["id"]: "online" for client in CLIENTS},
            "latest_metrics": None,
            "error": None,
        }

    def status(self) -> dict:
        with self._lock:
            return {**self._status, "client_status": dict(self._status["client_status"])}

    def history(self) -> list[dict]:
        value = read_json(HISTORY_PATH, [])
        if not isinstance(value, list):
            raise ValueError("Training history storage must contain a JSON list.")
        return value

    def start(
        self, rounds: int, epochs: int, learning_rate: float, batch_size: int
    ) -> dict:
        with self._lock:
            if self._worker is not None and self._worker.is_alive():
                raise RuntimeError("Training is already running.")
            self._stop_requested.clear()
            started_at = _now()
            self._status = {
                **self._idle_status(),
                "state": "running",
                "total_rounds": rounds,
                "started_at": started_at,
                "updated_at": started_at,
                "message": "Initializing model",
            }
            self._record_activity("Training session started", "info")
            self._worker = threading.Thread(
                target=self._run,
                args=(rounds, epochs, learning_rate, batch_size),
                name="fedshield-training",
                daemon=True,
            )
            self._worker.start()
            return self.status()

    def stop(self) -> dict:
        with self._lock:
            if self._status["state"] != "running":
                raise RuntimeError("There is no active training session.")
            self._stop_requested.set()
            self._status["message"] = "Stopping after the active local client finishes"
            self._status["updated_at"] = _now()
            return self.status()

    def _run(self, rounds: int, epochs: int, learning_rate: float, batch_size: int) -> None:
        try:
            model = BinaryClassifier()
            global_parameters = get_parameters(model)
            test_features, test_labels = load_test_data()
            history = self.history()
            for round_number in range(1, rounds + 1):
                updates = []
                losses = []
                for client in CLIENTS:
                    if self._stop_requested.is_set():
                        break
                    with self._lock:
                        self._status["message"] = f"Training locally on {client['name']}"
                        self._status["updated_at"] = _now()
                        self._status["client_status"][client["id"]] = "training"
                    features, labels = load_client_data(client["id"])
                    local_parameters, local_loss = train_local(
                        global_parameters,
                        features,
                        labels,
                        epochs=epochs,
                        batch_size=batch_size,
                        learning_rate=learning_rate,
                    )
                    updates.append((local_parameters, len(labels)))
                    losses.append(local_loss)
                    with self._lock:
                        self._status["client_status"][client["id"]] = "online"
                if self._stop_requested.is_set():
                    break

                # This demo uses ordinary FedAvg. Flower SecAgg+ is not enabled here.
                global_parameters = fedavg(updates)
                metrics = evaluate(global_parameters, test_features, test_labels)
                entry = {
                    "round": round_number,
                    "timestamp": _now(),
                    "clients_participated": len(updates),
                    "accuracy": metrics["accuracy"],
                    "precision": metrics["precision"],
                    "recall": metrics["recall"],
                    "f1": metrics["f1"],
                    "loss": metrics["loss"],
                    "local_loss": sum(losses) / max(1, len(losses)),
                    "confusion_matrix": metrics["confusion_matrix"],
                    "aggregation": "FedAvg (not secure aggregation)",
                }
                history.append(entry)
                write_json(HISTORY_PATH, history)
                write_json(METRICS_PATH, metrics)
                with self._lock:
                    self._status.update(
                        current_round=round_number,
                        progress=round_number * 100 // rounds,
                        updated_at=_now(),
                        latest_metrics=metrics,
                        message=f"Round {round_number} completed",
                    )
            with self._lock:
                was_stopped = self._stop_requested.is_set()
                self._status.update(
                    state="stopped" if was_stopped else "completed",
                    progress=self._status["progress"],
                    updated_at=_now(),
                    message="Training stopped" if was_stopped else "Training completed",
                )
            self._record_activity(
                "Training session stopped" if was_stopped else "Training session completed",
                "warning" if was_stopped else "success",
            )
        except Exception as exc:
            with self._lock:
                self._status.update(
                    state="failed",
                    updated_at=_now(),
                    message="Training failed",
                    error=str(exc),
                    client_status={client["id"]: "online" for client in CLIENTS},
                )
            self._record_activity("Training session failed", "error")

    def _record_activity(self, message: str, level: str) -> None:
        activities = read_json(ACTIVITY_PATH, [])
        if not isinstance(activities, list):
            raise ValueError("Activity storage must contain a JSON list.")
        activities.insert(0, {"timestamp": _now(), "message": message, "level": level})
        write_json(ACTIVITY_PATH, activities[:100])

    def dashboard(self) -> dict:
        history = self.history()
        latest_metrics = history[-1] if history else None
        activities = read_json(ACTIVITY_PATH, [])
        counts = client_sample_counts()
        status = self.status()
        return {
            "total_clients": len(CLIENTS),
            "total_training_samples": sum(counts.values()),
            "test_samples": round(TRAINING_SAMPLES * HOLDOUT_FRACTION),
            "connected_clients": sum(
                state in {"online", "training"} for state in status["client_status"].values()
            ),
            "completed_rounds": len(history),
            "training_status": status["state"],
            "accuracy": latest_metrics["accuracy"] if latest_metrics else None,
            "loss": latest_metrics["loss"] if latest_metrics else None,
            "total_sessions": sum(
                1 for event in activities if event["message"] == "Training session started"
            ),
            "secure_aggregation": {
                "status": "not_configured",
                "label": "Flower SecAgg+ not enabled",
            },
            "privacy": {
                "raw_records_sent_to_api": False,
                "test_data_separate": True,
                "individual_updates_protected": False,
                "note": "The local demo does not transmit dataset rows, but standard FedAvg exposes individual updates to its aggregator.",
            },
            "client_samples": counts,
            "history": history[-20:],
            "activities": activities[:8],
            "current_training": status,
        }


training_service = TrainingService()
