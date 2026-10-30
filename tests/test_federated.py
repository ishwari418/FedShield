import numpy as np
import pytest

from backend.config import TRAINING_SAMPLES
from backend.federated.dataset import client_sample_counts, load_client_data, load_test_data
from backend.federated.model import BinaryClassifier, evaluate, fedavg, get_parameters, train_local


def test_fedavg_is_sample_weighted():
    actual = fedavg(
        [
            ([np.array([1.0, 3.0])], 1),
            ([np.array([5.0, 7.0])], 3),
        ]
    )
    np.testing.assert_allclose(actual[0], np.array([4.0, 6.0]))


def test_fedavg_rejects_empty_or_incompatible_updates():
    with pytest.raises(ValueError):
        fedavg([])
    with pytest.raises(ValueError):
        fedavg([([np.ones(2)], 1), ([np.ones(3)], 1)])


def test_each_client_has_data_and_test_partition_is_independent():
    partitions = [load_client_data(f"hospital-{letter}") for letter in "abc"]
    test_features, test_labels = load_test_data()
    assert all(len(features) == len(labels) > 0 for features, labels in partitions)
    counts = client_sample_counts()
    assert sum(counts.values()) == TRAINING_SAMPLES == 100_000
    assert sorted(counts.values()) == [33_333, 33_333, 33_334]
    assert len(test_features) == len(test_labels) == 20_000
    test_rows = {
        tuple(features.tolist()) + (int(label),)
        for features, label in zip(test_features, test_labels, strict=True)
    }
    client_rows = {
        tuple(features.tolist()) + (int(label),)
        for partition_features, partition_labels in partitions
        for features, label in zip(partition_features, partition_labels, strict=True)
    }
    assert client_rows.isdisjoint(test_rows)
    train_features = np.concatenate([features for features, _ in partitions])
    np.testing.assert_allclose(train_features.mean(axis=0), np.zeros(8), atol=1e-5)
    np.testing.assert_allclose(train_features.std(axis=0), np.ones(8), atol=1e-5)


def test_local_torch_training_and_evaluation_produce_finite_metrics():
    features, labels = load_client_data("hospital-a")
    model = BinaryClassifier()
    updated, loss = train_local(
        get_parameters(model),
        features,
        labels,
        epochs=1,
        batch_size=256,
        learning_rate=0.05,
    )
    metrics = evaluate(updated, *load_test_data())
    assert np.isfinite(loss)
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert np.isfinite(metrics["loss"])
    assert sum(map(sum, metrics["confusion_matrix"])) == len(load_test_data()[1])
