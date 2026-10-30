from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
CLIENT_DATA_DIR = DATA_DIR / "clients"
TEST_DATA_DIR = DATA_DIR / "global_test"
STORAGE_DIR = PROJECT_ROOT / "storage"
CLIENTS = [
    {"id": "hospital-a", "name": "Hospital A", "color": "#45c8ff"},
    {"id": "hospital-b", "name": "Hospital B", "color": "#8b83ff"},
    {"id": "hospital-c", "name": "Hospital C", "color": "#39d9a5"},
]
FEATURE_COUNT = 8
SEED = 41
TRAINING_SAMPLES = 100_000
HOLDOUT_FRACTION = 0.2
DATASET_VERSION = 2
