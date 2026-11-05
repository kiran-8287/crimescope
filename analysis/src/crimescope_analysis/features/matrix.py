"""Stable preprocessing for region-by-category method matrices."""
from __future__ import annotations

import math


def vectors_from_matrix(matrix_data: dict, feature_mode: str = "raw_counts") -> list[list[float]]:
    regions = matrix_data["regions"]
    categories = matrix_data["categories"]
    raw = [[float(matrix_data["matrix"][region][category]) for category in categories] for region in regions]
    if feature_mode == "raw_counts":
        return raw
    if feature_mode != "log1p_zscore":
        raise ValueError(f"Unsupported feature mode: {feature_mode}")
    logged = [[math.log1p(max(0.0, value)) for value in vector] for vector in raw]
    if not logged:
        return logged
    n_features = len(categories)
    means = [sum(vector[j] for vector in logged) / len(logged) for j in range(n_features)]
    scales = [math.sqrt(sum((vector[j] - means[j]) ** 2 for vector in logged) / len(logged)) for j in range(n_features)]
    return [[(vector[j] - means[j]) / (scales[j] or 1.0) for j in range(n_features)] for vector in logged]
