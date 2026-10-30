import numpy as np
import torch
from torch import nn

from backend.config import FEATURE_COUNT

torch.set_num_threads(1)


class BinaryClassifier(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(FEATURE_COUNT, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.layers(inputs).squeeze(1)


def get_parameters(model: BinaryClassifier) -> list[np.ndarray]:
    return [value.detach().cpu().numpy().copy() for value in model.state_dict().values()]


def set_parameters(model: BinaryClassifier, parameters: list[np.ndarray]) -> None:
    state = model.state_dict()
    if len(parameters) != len(state):
        raise ValueError("Model update has an unexpected number of tensors.")
    updated = {}
    for (name, current), value in zip(state.items(), parameters, strict=True):
        array = np.asarray(value)
        if array.shape != tuple(current.shape):
            raise ValueError(f"Model update has an invalid shape for {name}.")
        updated[name] = torch.as_tensor(array, dtype=current.dtype)
    model.load_state_dict(updated, strict=True)


def train_local(
    parameters: list[np.ndarray],
    features: np.ndarray,
    labels: np.ndarray,
    *,
    epochs: int,
    batch_size: int,
    learning_rate: float,
) -> tuple[list[np.ndarray], float]:
    if len(features) == 0:
        raise ValueError("A client must have at least one local record.")
    model = BinaryClassifier()
    set_parameters(model, parameters)
    optimizer = torch.optim.SGD(model.parameters(), lr=learning_rate)
    loss_function = nn.BCEWithLogitsLoss()
    data = torch.utils.data.TensorDataset(
        torch.from_numpy(features), torch.from_numpy(labels.astype(np.float32))
    )
    loader = torch.utils.data.DataLoader(
        data, batch_size=batch_size, shuffle=True, generator=torch.Generator().manual_seed(7)
    )
    total_loss = 0.0
    for _ in range(epochs):
        for batch_features, batch_labels in loader:
            optimizer.zero_grad()
            loss = loss_function(model(batch_features), batch_labels)
            loss.backward()
            optimizer.step()
            total_loss += float(loss.detach())
    return get_parameters(model), total_loss / max(1, epochs * len(loader))


def fedavg(updates: list[tuple[list[np.ndarray], int]]) -> list[np.ndarray]:
    """Compute sample-weighted FedAvg for matching model tensor sets."""
    if not updates or any(count <= 0 for _, count in updates):
        raise ValueError("FedAvg needs non-empty updates with positive sample counts.")
    reference = updates[0][0]
    if any(len(parameters) != len(reference) for parameters, _ in updates):
        raise ValueError("Client model updates have incompatible tensor counts.")
    total = sum(count for _, count in updates)
    averaged: list[np.ndarray] = []
    for tensor_index, reference_tensor in enumerate(reference):
        if any(
            np.asarray(parameters[tensor_index]).shape != np.asarray(reference_tensor).shape
            for parameters, _ in updates
        ):
            raise ValueError("Client model updates have incompatible tensor shapes.")
        averaged.append(
            (
                sum(
                np.asarray(parameters[tensor_index], dtype=np.float64) * count
                for parameters, count in updates
                )
                / total
            ).astype(np.asarray(reference_tensor).dtype)
        )
    return averaged


def evaluate(parameters: list[np.ndarray], features: np.ndarray, labels: np.ndarray) -> dict:
    model = BinaryClassifier()
    set_parameters(model, parameters)
    with torch.no_grad():
        inputs = torch.from_numpy(features)
        targets = torch.from_numpy(labels.astype(np.float32))
        logits = model(inputs)
        loss = float(nn.BCEWithLogitsLoss()(logits, targets))
        predictions = (torch.sigmoid(logits) >= 0.5).to(torch.int64).numpy()
    truth = labels.astype(np.int64)
    true_positive = int(np.sum((truth == 1) & (predictions == 1)))
    true_negative = int(np.sum((truth == 0) & (predictions == 0)))
    false_positive = int(np.sum((truth == 0) & (predictions == 1)))
    false_negative = int(np.sum((truth == 1) & (predictions == 0)))
    precision = true_positive / max(1, true_positive + false_positive)
    recall = true_positive / max(1, true_positive + false_negative)
    return {
        "accuracy": (true_positive + true_negative) / max(1, len(truth)),
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / max(1e-12, precision + recall),
        "loss": loss,
        "confusion_matrix": [[true_negative, false_positive], [false_negative, true_positive]],
    }
