"""PCA on documented region-by-category feature matrices."""
from __future__ import annotations

import csv
import json
from pathlib import Path
import numpy as np


def load_feature_matrix(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            row["total"] = int(row["total"]) if row.get("total") else 0
            row["year"] = int(row["year"])
            rows.append(row)
    return rows


def build_matrix(rows: list[dict], year: int, min_region_cases: int = 0, feature_mode: str = "raw_counts") -> dict:
    year_rows = [r for r in rows if r["year"] == year and r["total"] >= min_region_cases]
    def key(row: dict) -> str:
        return row.get("region_id") or f"{row.get('state_name', '')}|{row['region_name']}"
    regions = sorted({key(r) for r in year_rows})
    categories = sorted({r["category"] for r in year_rows})
    matrix = {region: {category: 0 for category in categories} for region in regions}
    region_ids, region_labels, category_ids = {}, {}, {}
    for row in year_rows:
        region_key = key(row)
        matrix[region_key][row["category"]] = row["total"]
        if row.get("region_id"):
            region_ids[region_key] = row["region_id"]
        region_labels[region_key] = f"{row.get('state_name', '')} · {row['region_name']}".strip(" ·")
        if row.get("category_id"):
            category_ids[row["category"]] = row["category_id"]
    return {"year": year, "regions": regions, "categories": categories, "matrix": matrix,
            "region_ids": region_ids, "region_labels": region_labels, "category_ids": category_ids, "feature_mode": feature_mode}


def _prepare(matrix_data: dict) -> np.ndarray:
    X = np.asarray([[float(matrix_data["matrix"][r][c]) for c in matrix_data["categories"]]
                    for r in matrix_data["regions"]], dtype=float)
    mode = matrix_data.get("feature_mode", "raw_counts")
    if mode == "log1p_zscore":
        X = np.log1p(np.maximum(X, 0.0))
        scales = X.std(axis=0, ddof=0)
        scales[scales == 0] = 1.0
        X = (X - X.mean(axis=0)) / scales
    elif mode != "raw_counts":
        raise ValueError(f"Unsupported PCA feature mode: {mode}")
    return X - X.mean(axis=0)


def pca(matrix_data: dict, n_components: int = 2) -> dict:
    regions, categories = matrix_data["regions"], matrix_data["categories"]
    n_regions, n_categories = len(regions), len(categories)
    if n_regions < 2 or n_categories < 2:
        return {"year": matrix_data["year"], "n_regions": n_regions, "n_categories": n_categories,
                "n_components": 0, "eigenvalues": [], "explained_variance_ratio": [],
                "cumulative_variance_ratio": [], "loadings": [], "components": [],
                "message": "Insufficient data for PCA"}
    centered = _prepare(matrix_data)
    u, singular, vt = np.linalg.svd(centered, full_matrices=False)
    all_eigenvalues = singular ** 2 / (n_regions - 1)
    total_variance = float(all_eigenvalues.sum())
    k = min(n_components, len(singular))
    eigenvalues = all_eigenvalues[:k]
    ratios = eigenvalues / total_variance if total_variance > 0 else np.zeros(k)
    components = []
    for index, region in enumerate(regions):
        components.append({"region": matrix_data.get("region_labels", {}).get(region, region), "region_id": matrix_data.get("region_ids", {}).get(region),
                           "scores": [{"component": f"PC{i + 1}", "score": round(float(u[index, i] * singular[i]), 8)} for i in range(k)]})
    loadings = []
    for i in range(k):
        loadings.append({"component": f"PC{i + 1}", "eigenvalue": float(eigenvalues[i]),
                         "explained_variance_ratio": float(ratios[i]),
                         "features": [{"id": matrix_data.get("category_ids", {}).get(category),
                                       "category": category,
                                       "loading": float(vt[i, j] * np.sqrt(eigenvalues[i]))}
                                      for j, category in enumerate(categories)]})
    running = 0.0
    cumulative = []
    for ratio in ratios:
        running += float(ratio); cumulative.append(running)
    return {"year": matrix_data["year"], "n_regions": n_regions, "n_categories": n_categories,
            "n_components": k, "feature_mode": matrix_data.get("feature_mode", "raw_counts"),
            "total_feature_variance": total_variance, "eigenvalues": eigenvalues.tolist(),
            "explained_variance_ratio": ratios.tolist(), "cumulative_variance_ratio": cumulative,
            "loadings": loadings, "components": components}


def run_pca(input_csv: Path, output_dir: Path, years: list[int], feature_mode: str = "raw_counts") -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = load_feature_matrix(input_csv)
    results = {}
    for year in years:
        result = pca(build_matrix(rows, year, feature_mode=feature_mode), n_components=2)
        results[year] = result
        (output_dir / f"pca_{year}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return {"method": "05_pca", "years_analyzed": years, "feature_mode": feature_mode, "output_dir": str(output_dir)}
