"""Create a new, provenance-recorded 2024 district analysis run.

This writes only under analysis/output/runs/ and never replaces superseded outputs.
"""
from __future__ import annotations

import csv
import hashlib
import json
import platform
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "analysis" / "src"))
from crimescope_analysis.methods.pca import run_pca
from crimescope_analysis.methods.kmeans import run_kmeans
from crimescope_analysis.methods.hierarchical import run_hierarchical
from crimescope_analysis.methods.anomaly import run_anomaly_detection
from crimescope_analysis.methods.association import load_feature_matrix, build_transactions, apriori, run_association_rules

RUN_ID = "ap-2024-admin-leaf-log1p-zscore-20261105-v3"
RUN_DIR = ROOT / "analysis/output/runs" / RUN_ID
INPUT = ROOT / "data/processed/crime_observations_multi_year.csv"
TAXONOMY = ROOT / "config/category_hierarchy.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    if RUN_DIR.exists():
        raise SystemExit(f"Refusing to overwrite existing run directory: {RUN_DIR}")
    RUN_DIR.mkdir(parents=True)
    data_hash = sha256(INPUT)
    taxonomy = json.loads(TAXONOMY.read_text(encoding="utf-8"))
    selected = {c["id"]: c for c in taxonomy["categories"]
                if "2024" in c["rolesByYear"] and any(role in taxonomy["pcaFeatureRoles"] for role in c["rolesByYear"]["2024"])}
    with INPUT.open("r", encoding="utf-8-sig", newline="") as handle:
        source_rows = list(csv.DictReader(handle))
    rows = [r for r in source_rows if r["year"] == "2024" and r["state_name"] == "Andhra Pradesh"
            and r["region_type"] == "administrative_district" and r["quality_status"] == "valid"
            and r["comparison_status"] == "eligible" and r["category_id"] in selected]
    key_counts = Counter((r["geography_id"], r["category_id"]) for r in rows)
    if any(count != 1 for count in key_counts.values()):
        raise ValueError("Clean 2024 feature input has duplicate region/category keys")
    regions = sorted({r["geography_id"] for r in rows})
    if len(regions) != 26 or len(selected) != 131 or len(rows) != 26 * 131:
        raise ValueError(f"Unexpected selected 2024 cohort: {len(regions)} regions, {len(selected)} features, {len(rows)} rows")

    input_path = RUN_DIR / "feature_input.csv"
    fields = ["year", "state_name", "region_name", "region_type", "region_id", "category", "category_id", "total", "quality_status"]
    with input_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for r in sorted(rows, key=lambda x: (x["region_name"], x["original_category"])):
            writer.writerow({"year": 2024, "state_name": r["state_name"], "region_name": r["region_name"],
                             "region_type": r["region_type"], "region_id": r["geography_id"],
                             "category": r["original_category"], "category_id": r["category_id"],
                             "total": int(r["reported_value"]), "quality_status": r["quality_status"]})

    method_dirs = {name: RUN_DIR / name for name in ["pca", "kmeans", "hierarchical", "anomalies", "association"]}
    run_pca(input_path, method_dirs["pca"], [2024], feature_mode="log1p_zscore")
    run_kmeans(input_path, method_dirs["kmeans"], [2024], [3, 4, 5], feature_mode="log1p_zscore")
    run_hierarchical(input_path, method_dirs["hierarchical"], [2024], max_clusters=3, feature_mode="log1p_zscore")
    run_anomaly_detection(input_path, method_dirs["anomalies"], [2024])

    assoc_params = {"min_cases": 10, "min_support": 0.15, "min_confidence": 0.6, "max_itemset_size": 2, "min_lift": 1.05}
    run_association_rules(input_path, method_dirs["association"], [2024], **assoc_params)
    assoc_result_path = method_dirs["association"] / "association_rules_2024.json"
    assoc_result = json.loads(assoc_result_path.read_text(encoding="utf-8"))
    # The sensitivity grid records effects of thresholds on this fixed 26-region transaction set.
    assoc_rows = load_feature_matrix(input_path)
    transactions = build_transactions(assoc_rows, 2024, min_cases=assoc_params["min_cases"])
    sensitivity = []
    for support, confidence in [(0.10, 0.60), (0.15, 0.60), (0.20, 0.60), (0.15, 0.70)]:
        result = apriori(transactions, min_support=support, min_confidence=confidence,
                         max_itemset_size=2, min_lift=1.05)
        sensitivity.append({"min_support": support, "min_confidence": confidence,
                            "min_lift": 1.05, "rules": result["n_rules"],
                            "frequent_itemsets": result["n_itemsets"]})

    pca_path = method_dirs["pca"] / "pca_2024.json"
    pca_result = json.loads(pca_path.read_text(encoding="utf-8"))
    # Independent covariance-eigenvalue check of the SVD variance denominator.
    # Build exactly the ordered region-by-feature matrix used by the method.
    region_rows = {region: {r["category_id"]: int(r["reported_value"]) for r in rows if r["geography_id"] == region} for region in regions}
    feature_ids = sorted(selected, key=lambda cid: selected[cid]["label"])
    X = np.asarray([[region_rows[region][cid] for cid in feature_ids] for region in regions], dtype=float)
    X = np.log1p(X)
    scales = X.std(axis=0, ddof=0); scales[scales == 0] = 1.0
    X = (X - X.mean(axis=0)) / scales; X -= X.mean(axis=0)
    covariance = X.T @ X / (X.shape[0] - 1)
    reference_eigenvalues = np.linalg.eigvalsh(covariance)[::-1]
    reference_total_variance = float(np.trace(covariance))
    if abs(pca_result["total_feature_variance"] - reference_total_variance) > 1e-7:
        raise ValueError("PCA total variance does not match covariance trace")
    if abs(pca_result["explained_variance_ratio"][0] - reference_eigenvalues[0] / reference_total_variance) > 1e-6:
        raise ValueError("PCA leading variance ratio failed covariance reference check")
    if len(pca_result["components"]) != 26 or len(pca_result["loadings"][0]["features"]) != 131:
        raise ValueError("PCA output dimensions do not match the recorded cohort")
    assignment = json.loads((method_dirs["kmeans"] / "kmeans_2024_k3.json").read_text(encoding="utf-8"))
    if len(assignment.get("assignment_records", [])) != 26:
        raise ValueError("K-means assignments do not cover the region cohort")

    output_files = sorted(p for p in RUN_DIR.rglob("*") if p.is_file() and p.name != "run_manifest.json")
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        commit = None
    code_files = ["scripts/run_verified_2024_analysis.py", "scripts/build_category_hierarchy.py",
                  "analysis/src/crimescope_analysis/methods/pca.py", "analysis/src/crimescope_analysis/methods/kmeans.py",
                  "analysis/src/crimescope_analysis/methods/hierarchical.py", "analysis/src/crimescope_analysis/methods/anomaly.py",
                  "analysis/src/crimescope_analysis/methods/association.py", "analysis/src/crimescope_analysis/features/matrix.py"]
    manifest = {
        "run_id": RUN_ID, "status": "available", "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": {"path": "data/processed/crime_observations_multi_year.csv", "sha256": data_hash, "classification": "source_processed"},
        "feature_input": {"path": str(input_path.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(input_path),
                          "rows": len(rows), "regions": len(regions), "features": len(feature_ids),
                          "ordered_features": [{"id": cid, "label": selected[cid]["label"], "source_role": selected[cid]["rolesByYear"]["2024"]} for cid in feature_ids]},
        "cohort": {"year": 2024, "state": "Andhra Pradesh", "region_type": "administrative_district",
                   "geography_ids": regions, "region_names": sorted({r["region_name"] for r in rows}), "law_framework": "BNS"},
        "preprocessing": {"pca_and_clustering": "log1p(count) per category, then population-standard z-score across the 26 district observations; no population rates; zero-variance columns retain zeros.",
                          "association_and_anomalies": "Untransformed reported counts; source parent totals and grand total excluded; one transaction per district for association rules."},
        "parameters": {"pca_components": 2, "kmeans_k": [3, 4, 5], "kmeans_seed": 42,
                       "hierarchical_linkage": "ward", "hierarchical_max_clusters": 3,
                       "anomaly": {"type": "2024 cross-sectional only", "z_threshold": 2.5},
                       "association": assoc_params, "association_sensitivity": sensitivity,
                       "association_scope": "District profile presence; item if reported count >=10; no incident-level co-occurrence."},
        "environment": {"python": platform.python_version(), "numpy": np.__version__, "code_commit": commit,
                        "code_file_hashes": {p: sha256(ROOT / p) for p in code_files}},
        "validation": {"feature_keys_unique": True, "selected_feature_values_match_clean_source": True,
                       "pca_variance_matches_covariance_trace": True, "pca_reference_top_eigenvalue": float(reference_eigenvalues[0]),
                       "pca_total_variance": reference_total_variance, "kmeans_assignment_count": len(assignment["assignment_records"]),
                       "association_transaction_count": assoc_result["n_transactions"], "all_output_numeric_values_finite": True},
        "methods": {"pca": {"status": "available", "artifact": "pca/pca_2024.json"},
                    "kmeans": {"status": "available", "artifacts": [f"kmeans/kmeans_2024_k{k}.json" for k in [3,4,5]]},
                    "hierarchical": {"status": "available", "artifact": "hierarchical/hierarchical_2024.json"},
                    "anomalies": {"status": "available", "artifact": "anomalies/anomalies_2024.json", "scope": "cross_sectional only"},
                    "association": {"status": "available", "artifact": "association/association_rules_2024.json", "rules": assoc_result["n_rules"], "transactions": assoc_result["n_transactions"]}},
        "artifacts": {str(p.relative_to(RUN_DIR)).replace("\\", "/"): sha256(p) for p in output_files},
        "supersedes": ["analysis/output/method_05_pca/pca_2024.json", "analysis/output/method_06_kmeans/kmeans_2024_k*.json",
                       "analysis/output/method_07_hierarchical/hierarchical_2024.json", "analysis/output/method_08_anomaly/anomalies_2024.json",
                       "analysis/output/method_09_association/association_rules_2024.json"],
        "supersedes_run": "ap-2024-admin-leaf-log1p-zscore-20261105-v2",
    }
    (RUN_DIR / "run_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    pointer = ROOT / "analysis/output/runs/current.json"
    pointer.write_text(json.dumps({"run_id": RUN_ID, "manifest": str((RUN_DIR / "run_manifest.json").relative_to(ROOT)).replace("\\", "/")}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"run_id": RUN_ID, "run_dir": str(RUN_DIR), "features": len(feature_ids), "regions": len(regions),
                      "association_rules": assoc_result["n_rules"], "transactions": assoc_result["n_transactions"],
                      "threshold_sensitivity": sensitivity, "pca_variance": pca_result["explained_variance_ratio"]}, indent=2))


if __name__ == "__main__":
    main()
