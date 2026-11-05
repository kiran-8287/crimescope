"""Bivariate analysis: category relationships and correlations."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from typing import Optional


def load_observations(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["reported_value"] = (
                int(row["reported_value"]) if row["reported_value"] else None
            )
            row["year"] = int(row["year"])
            rows.append(row)
    return rows


def _pearson(x: list[float], y: list[float]) -> float:
    n = len(x)
    if n < 2:
        return 0
    mx = sum(x) / n
    my = sum(y) / n
    num = sum((a - mx) * (b - my) for a, b in zip(x, y))
    den_x = math.sqrt(sum((a - mx) ** 2 for a in x))
    den_y = math.sqrt(sum((b - my) ** 2 for b in y))
    if den_x == 0 or den_y == 0:
        return 0
    return num / (den_x * den_y)


def category_correlation_matrix(
    observations: list[dict],
    year: int,
) -> dict:
    """Pearson correlation between categories within one year, aggregated by region."""
    # Aggregate by (region, category) for the year
    buckets: dict[tuple, int] = {}
    for obs in observations:
        if obs.get("quality_status") != "valid":
            continue
        if obs.get("comparison_status") != "eligible":
            continue
        if obs["year"] != year:
            continue
        if obs["reported_value"] is None:
            continue
        key = (obs.get("geography_id") or f"{obs['state_name']}|{obs['region_name']}", obs["original_category"])
        buckets[key] = buckets.get(key, 0) + obs["reported_value"]

    categories = sorted({cat for _, cat in buckets.keys()})
    regions = sorted({reg for reg, _ in buckets.keys()})

    # Build matrix: region x category
    matrix: dict[str, dict[str, int]] = {}
    for reg in regions:
        matrix[reg] = {cat: 0 for cat in categories}
    for (reg, cat), val in buckets.items():
        matrix[reg][cat] = val

    # Correlation between categories across regions
    corr: dict[str, dict[str, float]] = {}
    for c1 in categories:
        corr[c1] = {}
        for c2 in categories:
            x = [matrix[r][c1] for r in regions]
            y = [matrix[r][c2] for r in regions]
            corr[c1][c2] = round(_pearson(x, y), 4)

    return {
        "year": year,
        "regions": regions,
        "categories": categories,
        "correlation_matrix": corr,
    }


def top_category_pairs(
    observations: list[dict],
    year: int,
    top_n: int = 10,
) -> list[dict]:
    """Top positively correlated category pairs."""
    cm = category_correlation_matrix(observations, year)
    categories = cm["categories"]
    corr = cm["correlation_matrix"]
    pairs = []
    for i in range(len(categories)):
        for j in range(i + 1, len(categories)):
            c1 = categories[i]
            c2 = categories[j]
            pairs.append(
                {
                    "category_1": c1,
                    "category_2": c2,
                    "correlation": corr[c1][c2],
                    "year": year,
                }
            )
    pairs.sort(key=lambda p: p["correlation"], reverse=True)
    return pairs[:top_n]


def run_bivariate_analysis(
    input_csv: Path,
    output_dir: Path,
) -> dict:
    observations = load_observations(input_csv)
    output_dir.mkdir(parents=True, exist_ok=True)

    years = sorted({o["year"] for o in observations})
    results = {}
    for year in years:
        cm = category_correlation_matrix(observations, year)
        pairs = top_category_pairs(observations, year)
        results[year] = {
            "correlation_matrix": cm["correlation_matrix"],
            "top_pairs": pairs,
        }
        with (output_dir / f"correlation_{year}.json").open("w", encoding="utf-8") as f:
            json.dump(results[year], f, indent=2)

    return {
        "input_observations": len(observations),
        "years_analyzed": years,
        "output_dir": str(output_dir),
    }
