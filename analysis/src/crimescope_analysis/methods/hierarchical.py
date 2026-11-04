"""Hierarchical clustering on region x category matrix."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from typing import Optional


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
) -> dict:
    year_rows = [r for r in rows if r["year"] == year]
    regions = sorted({r["region_name"] for r in year_rows})
    categories = sorted({r["category"] for r in year_rows})

    matrix: dict[str, dict[str, int]] = {}
    for reg in regions:
        matrix[reg] = {cat: 0 for cat in categories}
    for r in year_rows:
        matrix[r["region_name"]][r["category"]] = r["total"]

    return {
        "year": year,
        "regions": regions,
        "categories": categories,
        "matrix": matrix,
    }


def _euclidean(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _ward_distance(
    cluster1: list[int],
    cluster2: list[int],
    vectors: list[list[float]],
) -> float:
    """Ward linkage distance between two clusters."""
    all_members = cluster1 + cluster2
    n = len(all_members)
    centroid = [
        sum(vectors[i][j] for i in all_members) / n for j in range(len(vectors[0]))
    ]
    ss = sum(
        sum((vectors[i][j] - centroid[j]) ** 2 for j in range(len(vectors[0])))
        for i in all_members
    )
    return ss


def hierarchical_clustering(
    matrix_data: dict,
    max_clusters: int = 3,
    linkage: str = "ward",
) -> dict:
    """Agglomerative hierarchical clustering."""
    regions = matrix_data["regions"]
    categories = matrix_data["categories"]
    matrix = matrix_data["matrix"]

    n_regions = len(regions)
    if n_regions < 2:
        return {
            "year": matrix_data["year"],
            "linkage": linkage,
            "n_regions": n_regions,
            "clusters": [],
            "merge_history": [],
            "message": "Insufficient regions for clustering",
        }

    # Build vectors
    vectors = []
    for reg in regions:
        vectors.append([float(matrix[reg][cat]) for cat in categories])

    # Initial: each region is its own cluster
    clusters = [[i] for i in range(n_regions)]
    merge_history = []

    while len(clusters) > max_clusters:
        # Find closest pair
        best_i, best_j = -1, -1
        best_dist = float("inf")

        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                if linkage == "ward":
                    d = _ward_distance(clusters[i], clusters[j], vectors)
                else:
                    # Single linkage: min distance between members
                    d = min(
                        _euclidean(vectors[a], vectors[b])
                        for a in clusters[i]
                        for b in clusters[j]
                    )
                if d < best_dist:
                    best_dist = d
                    best_i, best_j = i, j

        # Merge
        merged = clusters[best_i] + clusters[best_j]
        merge_history.append(
            {
                "clusters_merged": [best_i, best_j],
                "distance": round(best_dist, 6),
                "new_cluster_size": len(merged),
                "remaining_clusters": len(clusters) - 1,
            }
        )

        # Remove merged clusters, add new one
        new_clusters = []
        for idx, c in enumerate(clusters):
            if idx not in (best_i, best_j):
                new_clusters.append(c)
        new_clusters.append(merged)
        clusters = new_clusters

    # Build final clusters
    final_clusters = []
    for ci, c in enumerate(clusters):
        final_clusters.append(
            {
                "cluster_id": ci,
                "size": len(c),
                "regions": [regions[i] for i in c],
            }
        )

    return {
        "year": matrix_data["year"],
        "linkage": linkage,
        "n_regions": n_regions,
        "n_categories": len(categories),
        "max_clusters": max_clusters,
        "merge_history": merge_history,
        "clusters": final_clusters,
    }


def run_hierarchical(
    input_csv: Path,
    output_dir: Path,
    years: list[int],
    max_clusters: int = 3,
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = load_feature_matrix(input_csv)

    results = {}
    for year in years:
        matrix_data = build_matrix(rows, year)
        hr = hierarchical_clustering(matrix_data, max_clusters=max_clusters)
        results[year] = hr
        with (output_dir / f"hierarchical_{year}.json").open("w", encoding="utf-8") as f:
            json.dump(hr, f, indent=2)

    return {
        "method": "07_hierarchical_clustering",
        "years_analyzed": years,
        "max_clusters": max_clusters,
        "output_dir": str(output_dir),
    }
