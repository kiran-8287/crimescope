"""K-means clustering on region x category matrix."""

from __future__ import annotations

import csv
import json
import math
import random
from pathlib import Path
from typing import Optional
from crimescope_analysis.features.matrix import vectors_from_matrix


def load_feature_matrix(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["total"] = int(row["total"]) if row["total"] else 0
            row["year"] = int(row["year"])
            rows.append(row)
    return rows


def build_matrix(
    rows: list[dict],
    year: int,
    feature_mode: str = "raw_counts",
) -> dict:
    year_rows = [r for r in rows if r["year"] == year]
    def key(row: dict) -> str:
        return row.get("region_id") or f"{row.get('state_name', '')}|{row['region_name']}"
    regions = sorted({key(r) for r in year_rows})
    categories = sorted({r["category"] for r in year_rows})

    matrix: dict[str, dict[str, int]] = {}
    for reg in regions:
        matrix[reg] = {cat: 0 for cat in categories}
    for r in year_rows:
        matrix[key(r)][r["category"]] = r["total"]

    region_ids = {key(r): r.get("region_id") for r in year_rows if r.get("region_id")}
    region_labels = {key(r): f"{r.get('state_name', '')} · {r['region_name']}".strip(" ·") for r in year_rows}
    category_ids = {r["category"]: r.get("category_id") for r in year_rows if r.get("category_id")}
    return {
        "year": year,
        "regions": regions,
        "categories": categories,
        "matrix": matrix,
        "region_ids": region_ids,
        "region_labels": region_labels,
        "category_ids": category_ids,
        "feature_mode": feature_mode,
    }


def _euclidean(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def kmeans(
    matrix_data: dict,
    k: int = 3,
    max_iterations: int = 100,
    seed: int = 42,
) -> dict:
    """K-means clustering on region x category matrix."""
    regions = matrix_data["regions"]
    categories = matrix_data["categories"]
    matrix = matrix_data["matrix"]

    n_regions = len(regions)
    n_categories = len(categories)
    feature_mode = matrix_data.get("feature_mode", "raw_counts")

    if n_regions < k:
        return {
            "year": matrix_data["year"],
            "k": k,
            "n_regions": n_regions,
            "n_categories": n_categories,
            "clusters": [],
            "centroids": [],
            "inertia": 0,
            "message": f"Insufficient regions ({n_regions}) for k={k}",
        }

    # Build data vectors
    vectors = vectors_from_matrix(matrix_data, feature_mode)

    # K-means++ initialization
    random.seed(seed)
    centroids = [vectors[random.randint(0, n_regions - 1)]]
    for _ in range(1, k):
        distances = [
            min(_euclidean(v, c) for c in centroids) for v in vectors
        ]
        total = sum(d * d for d in distances)
        if total == 0:
            centroids.append(vectors[random.randint(0, n_regions - 1)])
        else:
            probs = [d * d / total for d in distances]
            r = random.random()
            cumulative = 0
            for i, p in enumerate(probs):
                cumulative += p
                if r <= cumulative:
                    centroids.append(vectors[i])
                    break

    # Iterate
    assignments = [0] * n_regions
    for iteration in range(max_iterations):
        # Assign
        new_assignments = []
        for v in vectors:
            best = 0
            best_dist = _euclidean(v, centroids[0])
            for c in range(1, k):
                d = _euclidean(v, centroids[c])
                if d < best_dist:
                    best_dist = d
                    best = c
            new_assignments.append(best)

        if new_assignments == assignments:
            break
        assignments = new_assignments

        # Update centroids
        for c in range(k):
            members = [vectors[i] for i in range(n_regions) if assignments[i] == c]
            if members:
                centroids[c] = [
                    sum(m[j] for m in members) / len(members) for j in range(n_categories)
                ]

    # Compute inertia
    inertia = sum(
        _euclidean(vectors[i], centroids[assignments[i]]) ** 2 for i in range(n_regions)
    )

    # Cluster sizes
    cluster_sizes = [0] * k
    for a in assignments:
        cluster_sizes[a] += 1

    # Cluster regions
    clusters = []
    for c in range(k):
        members = [matrix_data.get("region_labels", {}).get(regions[i], regions[i]) for i in range(n_regions) if assignments[i] == c]
        clusters.append(
            {
                "cluster_id": c,
                "size": cluster_sizes[c],
                "regions": members,
                "region_ids": [matrix_data.get("region_ids", {}).get(regions[i]) for i in range(n_regions) if assignments[i] == c],
                "centroid": {
                    categories[j]: round(centroids[c][j], 4) for j in range(n_categories)
                },
            }
        )

    return {
        "year": matrix_data["year"],
        "k": k,
        "n_regions": n_regions,
        "n_categories": n_categories,
        "feature_mode": feature_mode,
        "max_iterations": max_iterations,
        "seed": seed,
        "inertia": round(inertia, 6),
        "cluster_sizes": cluster_sizes,
        "clusters": clusters,
        "assignments": {matrix_data.get("region_ids", {}).get(regions[i], regions[i]): assignments[i] for i in range(n_regions)},
        "assignment_records": [{"region": matrix_data.get("region_labels", {}).get(regions[i], regions[i]), "region_id": matrix_data.get("region_ids", {}).get(regions[i]), "cluster_id": assignments[i]} for i in range(n_regions)],
    }


def run_kmeans(
    input_csv: Path,
    output_dir: Path,
    years: list[int],
    k_values: list[int],
    feature_mode: str = "raw_counts",
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = load_feature_matrix(input_csv)

    results = {}
    for year in years:
        matrix_data = build_matrix(rows, year, feature_mode=feature_mode)
        year_results = {}
        for k in k_values:
            if k <= len(matrix_data["regions"]):
                kr = kmeans(matrix_data, k=k)
                year_results[k] = kr
                with (output_dir / f"kmeans_{year}_k{k}.json").open("w", encoding="utf-8") as f:
                    json.dump(kr, f, indent=2)
        results[year] = year_results

    return {
        "method": "06_kmeans",
        "years_analyzed": years,
        "k_values": k_values,
        "feature_mode": feature_mode,
        "output_dir": str(output_dir),
    }
