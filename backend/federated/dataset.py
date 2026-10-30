from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from backend.config import (
    CLIENT_DATA_DIR,
    CLIENTS,
    DATA_DIR,
    DATASET_VERSION,
    FEATURE_COUNT,
    HOLDOUT_FRACTION,
    SEED,
    TEST_DATA_DIR,
    TRAINING_SAMPLES,
)
from backend.storage.json_storage import read_json, write_json

TARGET = "label"
MANIFEST_PATH = DATA_DIR / "dataset_manifest.json"


def _feature_names() -> list[str]:
    return [f"feature_{index + 1}" for index in range(FEATURE_COUNT)]


def _write_partition(folder: Path, features: np.ndarray, labels: np.ndarray) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    values = pd.DataFrame(features, columns=_feature_names())
    values[TARGET] = labels.astype(int)
    values.to_csv(folder / "records.csv", index=False)


def ensure_datasets() -> bool:
    """Create 100,000 standardized training rows and a separate 20% holdout once."""
    client_paths = [
        CLIENT_DATA_DIR / client["id"] / "records.csv" for client in CLIENTS
    ]
    test_path = TEST_DATA_DIR / "records.csv"
    test_samples = round(TRAINING_SAMPLES * HOLDOUT_FRACTION)
    expected_manifest = {
        "version": DATASET_VERSION,
        "seed": SEED,
        "training_samples": TRAINING_SAMPLES,
        "test_samples": test_samples,
    }
    manifest = read_json(MANIFEST_PATH, {})
    if (
        manifest == expected_manifest
        and test_path.exists()
        and all(path.exists() for path in client_paths)
    ):
        return False

    features, labels = make_classification(
        n_samples=TRAINING_SAMPLES + test_samples,
        n_features=FEATURE_COUNT,
        n_informative=6,
        n_redundant=1,
        n_repeated=0,
        n_classes=2,
        random_state=SEED,
    )
    train_features, test_features, train_labels, test_labels = train_test_split(
        features,
        labels,
        test_size=test_samples,
        random_state=SEED + 99,
        stratify=labels,
    )
    scaler = StandardScaler()
    train_features = scaler.fit_transform(train_features).astype(np.float32)
    test_features = scaler.transform(test_features).astype(np.float32)

    shuffled_indices = np.random.default_rng(SEED).permutation(len(train_features))
    for client, indices in zip(
        CLIENTS, np.array_split(shuffled_indices, len(CLIENTS)), strict=True
    ):
        _write_partition(
            CLIENT_DATA_DIR / client["id"],
            train_features[indices],
            train_labels[indices],
        )

    _write_partition(TEST_DATA_DIR, test_features, test_labels)
    write_json(MANIFEST_PATH, expected_manifest)
    return True


def load_client_data(client_id: str) -> tuple[np.ndarray, np.ndarray]:
    client = next((entry for entry in CLIENTS if entry["id"] == client_id), None)
    if client is None:
        raise ValueError("Unknown client.")
    path = CLIENT_DATA_DIR / client_id / "records.csv"
    frame = pd.read_csv(path)
    return frame[_feature_names()].to_numpy(dtype=np.float32), frame[TARGET].to_numpy(dtype=np.int64)


def load_test_data() -> tuple[np.ndarray, np.ndarray]:
    frame = pd.read_csv(TEST_DATA_DIR / "records.csv")
    return frame[_feature_names()].to_numpy(dtype=np.float32), frame[TARGET].to_numpy(dtype=np.int64)


def client_sample_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for client in CLIENTS:
        path = CLIENT_DATA_DIR / client["id"] / "records.csv"
        with path.open(encoding="utf-8") as file:
            counts[client["id"]] = max(0, sum(1 for _ in file) - 1)
    return counts
