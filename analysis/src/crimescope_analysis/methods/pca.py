"""PCA: Principal Component Analysis on region x category matrix."""

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
    min_region_cases: int = 0,
) -> dict:
    """Build a region x category matrix for one year."""
    year_rows = [r for r in rows if r["year"] == year and r["total"] >= min_region_cases]

    regions = sorted({r["region_name"] for r in year_rows})
    categories = sorted({r["category"] for r in year_rows})

    # Matrix: region -> category -> total
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


def _mean(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0


def _std(vals: list[float]) -> float:
    if len(vals) < 2:
        return 0
    m = _mean(vals)
    return math.sqrt(sum((v - m) ** 2 for v in vals) / (len(vals) - 1))


def pca(
    matrix_data: dict,
    n_components: int = 2,
) -> dict:
    """Perform PCA on the region x category matrix.

    Returns eigenvalues, eigenvectors (loadings), explained variance,
    and principal component scores for each region.
    """
    regions = matrix_data["regions"]
    categories = matrix_data["categories"]
    matrix = matrix_data["matrix"]

    n_regions = len(regions)
    n_categories = len(categories)

    if n_regions < 2 or n_categories < 2:
        return {
            "year": matrix_data["year"],
            "n_regions": n_regions,
            "n_categories": n_categories,
            "n_components": n_components,
            "eigenvalues": [],
            "explained_variance_ratio": [],
            "cumulative_variance_ratio": [],
            "loadings": [],
            "components": [],
            "message": "Insufficient data for PCA",
        }

    # Build data matrix: regions x categories
    X = []
    for reg in regions:
        X.append([float(matrix[reg][cat]) for cat in categories])

    # Center the data (subtract column means)
    col_means = [_mean([X[i][j] for i in range(n_regions)]) for j in range(n_categories)]
    X_centered = [[X[i][j] - col_means[j] for j in range(n_categories)] for i in range(n_regions)]

    # Compute covariance matrix (categories x categories)
    cov = [[0.0] * n_categories for _ in range(n_categories)]
    for j1 in range(n_categories):
        for j2 in range(n_categories):
            cov[j1][j2] = sum(
                X_centered[i][j1] * X_centered[i][j2] for i in range(n_regions)
            ) / (n_regions - 1)

    # Power iteration to find top eigenvalues/eigenvectors
    eigenvalues: list[float] = []
    eigenvectors: list[list[float]] = []

    # Copy covariance for deflation
    cov_work = [row[:] for row in cov]

    for k in range(min(n_components, n_categories)):
        # Power iteration
        v = [1.0 / math.sqrt(n_categories)] * n_categories
        for _ in range(1000):
            # Multiply by covariance
            v_new = [sum(cov_work[j][i] * v[i] for i in range(n_categories)) for j in range(n_categories)]
            # Normalize
            norm = math.sqrt(sum(x * x for x in v_new))
            if norm == 0:
                break
            v_new = [x / norm for x in v_new]
            # Check convergence
            diff = math.sqrt(sum((v_new[i] - v[i]) ** 2 for i in range(n_categories)))
            v = v_new
            if diff < 1e-10:
                break

        # Eigenvalue (Rayleigh quotient)
        lam = sum(
            v[j] * sum(cov_work[j][i] * v[i] for i in range(n_categories))
            for j in range(n_categories)
        )
        eigenvalues.append(lam)
        eigenvectors.append(v)

        # Deflate: remove this component from covariance
        for j1 in range(n_categories):
            for j2 in range(n_categories):
                cov_work[j1][j2] -= lam * v[j1] * v[j2]

    total_variance = sum(eigenvalues)
    explained_variance_ratio = [e / total_variance for e in eigenvalues] if total_variance > 0 else [0] * len(eigenvalues)
    cumulative = []
    running = 0
    for r in explained_variance_ratio:
        running += r
        cumulative.append(running)

    # Loadings: eigenvectors * sqrt(eigenvalue)
    loadings = []
    for k, (lam, vec) in enumerate(zip(eigenvalues, eigenvectors)):
        loadings.append(
            {
                "component": f"PC{k + 1}",
                "eigenvalue": round(lam, 6),
                "explained_variance_ratio": round(explained_variance_ratio[k], 6),
                "features": [
                    {
                        "category": categories[j],
                        "loading": round(vec[j] * math.sqrt(lam), 6),
                    }
                    for j in range(n_categories)
                ],
            }
        )

    # Component scores for each region: X_centered @ eigenvector
    components = []
    for i, reg in enumerate(regions):
        region_scores = []
        for k, vec in enumerate(eigenvectors):
            score = sum(X_centered[i][j] * vec[j] for j in range(n_categories))
            region_scores.append(
                {
                    "component": f"PC{k + 1}",
                    "score": round(score, 6),
                }
            )
        components.append(
            {
                "region": regions[i],
                "scores": region_scores,
            }
        )

    return {
        "year": matrix_data["year"],
        "n_regions": n_regions,
        "n_categories": n_categories,
        "n_components": n_components,
        "eigenvalues": [round(e, 6) for e in eigenvalues],
        "explained_variance_ratio": explained_variance_ratio,
        "cumulative_variance_ratio": cumulative,
        "loadings": loadings,
        "components": components,
    }


def run_pca(
    input_csv: Path,
    output_dir: Path,
    years: list[int],
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = load_feature_matrix(input_csv)

    results = {}
    for year in years:
        matrix_data = build_matrix(rows, year)
        pca_result = pca(matrix_data, n_components=2)
        results[year] = pca_result
        with (output_dir / f"pca_{year}.json").open("w", encoding="utf-8") as f:
            json.dump(pca_result, f, indent=2)

    return {
        "method": "05_pca",
        "years_analyzed": years,
        "output_dir": str(output_dir),
    }
