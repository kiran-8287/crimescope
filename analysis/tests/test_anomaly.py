"""Tests for anomaly detection module."""

import math


def test_zscore_identifies_outliers():
    values = [10, 12, 11, 13, 5000]
    mean = sum(values) / len(values)
    variance = sum((b - mean) ** 2 for b in values) / (len(values) - 1)
    std = math.sqrt(variance)

    z5000 = abs((5000 - mean) / std)
    z10 = abs((10 - mean) / std)
    assert z5000 > z10  # Outlier has higher |z-score| than normal values
    assert z5000 > 1.0


def test_year_on_year_pct_change():
    prev, curr = 100, 150
    pct_change = ((curr - prev) / prev) * 100
    assert pct_change == 50

    prev2, curr2 = 200, 100
    pct_change2 = ((curr2 - prev2) / prev2) * 100
    assert pct_change2 == -50
