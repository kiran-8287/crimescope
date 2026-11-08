"""Generate corrected national 2024 district methods on verified 774 administrative districts."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import platform
import re
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
from crimescope_analysis.methods.hierarchical import load_feature_matrix, build_matrix, hierarchical_clustering
from crimescope_analysis.methods.anomaly import run_anomaly_detection
from crimescope_analysis.methods.association import load_feature_matrix as load_association_rows, run_association_rules, build_transactions, apriori

RUN_ID = "ncrb-national-2024-admin-log1p-zscore-20261107-v4"
RELEASE_POINTER = ROOT / "data/serving/current.json"
TAXONOMY = ROOT / "config/category_hierarchy.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel_or_abs(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def active_release_source() -> tuple[Path, str]:
    """Resolve the active serving release's source dataset (path, sha256).

    The rerun input is taken from the pointer the backend actually serves, not from a
    hard-coded staging directory, so a rerun reproduces the dataset the app is using.
    """
    pointer = json.loads(RELEASE_POINTER.read_text(encoding="utf-8"))
    release_manifest = ROOT / pointer["release_path"] / "release_manifest.json"
    release = json.loads(release_manifest.read_text(encoding="utf-8"))
    source = release["source_dataset"]
    return ROOT / source["path"], source["sha256"]


def resolve_dataset(dataset_arg: str | None) -> tuple[Path, str | None]:
    """Return the (path, expected_sha256) for the method input.

    An explicit ``--dataset`` overrides the release-derived default; in that case the
    expected hash is unknown and no release-identity check is applied.
    """
    if dataset_arg:
        path = Path(dataset_arg)
        if not path.is_absolute():
            path = (ROOT / path).resolve()
        return path, None
    return active_release_source()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default=None,
                        help="Long-format observation CSV used as the method input. Defaults to the active "
                             "serving release's source dataset (data/serving/current.json).")
    parser.add_argument("--run-id", default=RUN_ID,
                        help="Run id. Artifacts are written to analysis/output/runs/<run-id>; an existing "
                             "directory is never overwritten, so pass a new id for an isolated rerun.")
    parser.add_argument("--taxonomy", default=str(TAXONOMY), help="Category hierarchy JSON.")
    args = parser.parse_args()

    run_dir = ROOT / "analysis/output/runs" / args.run_id
    if run_dir.exists():
        raise SystemExit(f"Refusing to overwrite existing run directory: {run_dir}")

    dataset_path, expected_sha = resolve_dataset(args.dataset)
    if not dataset_path.is_file():
        raise SystemExit(f"Resolved dataset not found: {dataset_path}")
    dataset_sha = digest(dataset_path)
    if expected_sha is not None and dataset_sha != expected_sha:
        raise SystemExit(f"Resolved dataset does not match the active release: expected {expected_sha}, "
                         f"got {dataset_sha} ({dataset_path})")

    taxonomy_path = Path(args.taxonomy)
    taxonomy = json.loads(taxonomy_path.read_text(encoding="utf-8"))
    feature_defs = {item["id"]: item for item in taxonomy["categories"]
                    if "2024" in item["rolesByYear"] and set(item["rolesByYear"]["2024"]) & set(taxonomy["pcaFeatureRoles"])}
    with dataset_path.open("r", encoding="utf-8-sig", newline="") as handle:
        source_rows = list(csv.DictReader(handle))
    cohort_rows = [row for row in source_rows if row["year"] == "2024" and row["region_type"] == "administrative_district"
                   and row["quality_status"] == "valid" and row["comparison_status"] == "eligible"
                   and row["category_id"] in feature_defs]
    regions = sorted({row["geography_id"] for row in cohort_rows})
    pairs = Counter((row["geography_id"], row["category_id"]) for row in cohort_rows)
    if any(count != 1 for count in pairs.values()):
        raise ValueError("Duplicate region/category records in the selected method cohort")
    if len(regions) != 774 or len(feature_defs) != 131 or len(cohort_rows) != len(regions) * len(feature_defs):
        raise ValueError(f"Unexpected 2024 method cohort: {len(regions)} districts × {len(feature_defs)} features, {len(cohort_rows)} rows")
    if any(row["reported_value"] == "" for row in cohort_rows):
        raise ValueError("Null feature values found; the method input will not impute them")

    run_dir.mkdir(parents=True)
    feature_path = run_dir / "feature_input.csv"
    fields = ["year", "state_name", "region_name", "region_type", "region_id", "category", "category_id", "total", "quality_status"]
    with feature_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in sorted(cohort_rows, key=lambda item: (item["state_name"], item["region_name"], item["category_id"])):
            definition = feature_defs[row["category_id"]]
            writer.writerow({"year": 2024, "state_name": row["state_name"], "region_name": row["region_name"],
                             "region_type": row["region_type"], "region_id": row["geography_id"],
                             "category": definition["label"], "category_id": row["category_id"],
                             "total": row["reported_value"], "quality_status": row["quality_status"]})

    method_dirs = {name: run_dir / name for name in ("pca", "kmeans", "hierarchical", "anomalies", "association")}
    run_pca(feature_path, method_dirs["pca"], [2024], feature_mode="log1p_zscore")
    run_kmeans(feature_path, method_dirs["kmeans"], [2024], [3, 4, 5], feature_mode="log1p_zscore")
    run_anomaly_detection(feature_path, method_dirs["anomalies"], [2024])

    matrix_rows = load_feature_matrix(feature_path)
    hierarchical_artifacts: dict[str, str] = {}
    for state in sorted({row["state_name"] for row in matrix_rows}):
        subset = [row for row in matrix_rows if row["state_name"] == state]
        matrix = build_matrix(subset, 2024, feature_mode="log1p_zscore")
        if len(matrix["regions"]) < 2:
            continue
        result = hierarchical_clustering(matrix, max_clusters=min(3, len(matrix["regions"])))
        state_slug = re.sub(r"[^a-z0-9]+", "-", state.casefold()).strip("-")
        relative = f"hierarchical/2024_{state_slug}.json"
        path = run_dir / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        hierarchical_artifacts[state] = relative

    assoc_params = {"min_cases": 10, "min_support": 0.15, "min_confidence": 0.60,
                    "max_itemset_size": 2, "min_lift": 1.05}
    run_association_rules(feature_path, method_dirs["association"], [2024], **assoc_params)
    assoc_path = method_dirs["association"] / "association_rules_2024.json"
    assoc = json.loads(assoc_path.read_text(encoding="utf-8"))
    assoc_rows = load_association_rows(feature_path)
    transactions = build_transactions(assoc_rows, 2024, min_cases=assoc_params["min_cases"])
    sensitivity = []
    for support, confidence in ((0.10, .60), (.15, .60), (.20, .60), (.15, .70)):
        result = apriori(transactions, min_support=support, min_confidence=confidence,
                         max_itemset_size=2, min_lift=assoc_params["min_lift"])
        sensitivity.append({"min_support": support, "min_confidence": confidence,
                            "min_lift": assoc_params["min_lift"], "rules": result["n_rules"]})

    pca = json.loads((method_dirs["pca"] / "pca_2024.json").read_text(encoding="utf-8"))
    expected_ids = sorted(regions)
    if sorted(row["region_id"] for row in pca["components"]) != expected_ids:
        raise ValueError("PCA scores do not cover the exact selected geography IDs")
    if sum(pca["explained_variance_ratio"]) > 1.000001:
        raise ValueError("PCA retained variance ratios exceed total feature variance")
    for k in (3, 4, 5):
        result = json.loads((method_dirs["kmeans"] / f"kmeans_2024_k{k}.json").read_text(encoding="utf-8"))
        if sorted(row["region_id"] for row in result["assignment_records"]) != expected_ids:
            raise ValueError(f"K-means k={k} does not cover the exact selected geography IDs")
    if not 0 < assoc["n_transactions"] <= len(regions):
        raise ValueError("Association transaction count is outside the selected district cohort")
    for state, relative in hierarchical_artifacts.items():
        result = json.loads((run_dir / relative).read_text(encoding="utf-8"))
        expected = {row["geography_id"] for row in source_rows if row["year"] == "2024" and row["state_name"] == state
                    and row["region_type"] == "administrative_district" and row["quality_status"] == "valid"
                    and row["comparison_status"] == "eligible" and row["category_id"] in feature_defs}
        got = {identifier for cluster in result["clusters"] for identifier in cluster["region_ids"]}
        if got != expected:
            raise ValueError(f"Hierarchical result for {state} does not cover its selected IDs")

    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        commit = None
    code_files = ["scripts/run_v4_analysis.py", "scripts/source_inputs.py", "scripts/build_phase_c.py",
                  "scripts/build_category_hierarchy.py", "analysis/src/crimescope_analysis/cleaning/canonical.py",
                  "analysis/src/crimescope_analysis/methods/pca.py", "analysis/src/crimescope_analysis/methods/kmeans.py",
                  "analysis/src/crimescope_analysis/methods/hierarchical.py", "analysis/src/crimescope_analysis/methods/anomaly.py",
                  "analysis/src/crimescope_analysis/methods/association.py"]
    output_files = sorted(path for path in run_dir.rglob("*") if path.is_file() and path.name != "run_manifest.json")
    methods = {"pca": {"status": "available", "artifact": "pca/pca_2024.json"},
               "kmeans": {"status": "available", "artifacts": [f"kmeans/kmeans_2024_k{k}.json" for k in (3,4,5)]},
               "hierarchical": {"status": "available", "artifacts_by_state": hierarchical_artifacts},
               "anomalies": {"status": "available", "artifact": "anomalies/anomalies_2024.json", "scope": "national cross-sectional only"},
               "association": {"status": "available", "artifact": "association/association_rules_2024.json", "rules": assoc["n_rules"], "transactions": assoc["n_transactions"]}}
    manifest = {
        "run_id": args.run_id, "status": "available", "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": {"path": rel_or_abs(dataset_path),
                    "sha256": dataset_sha, "classification": "rebuilt_expanded_processed"},
        "feature_input": {"path": str(feature_path.relative_to(ROOT)).replace("\\", "/"), "sha256": digest(feature_path),
                          "rows": len(cohort_rows), "regions": len(regions), "features": len(feature_defs),
                          "ordered_features": [{"id": cid, "label": feature_defs[cid]["label"], "source_role": feature_defs[cid]["rolesByYear"]["2024"]}
                                               for cid in sorted(feature_defs, key=lambda item: feature_defs[item]["label"].casefold())]},
        "cohort": {"year": 2024, "scope": "India, all included state/UTs", "region_type": "administrative_district",
                    "geography_ids": expected_ids, "state_count": len({row["state_name"] for row in cohort_rows}),
                    "geography_ids_by_state": {state: sorted({row["geography_id"] for row in cohort_rows if row["state_name"] == state})
                                                for state in sorted({row["state_name"] for row in cohort_rows})},
                    "region_names": sorted({row["region_name"] for row in cohort_rows}), "law_framework": "BNS"},
        "exclusions": {"source_observations_not_in_method_cohort": len(source_rows) - len(cohort_rows),
                       "non_district_unit_observations_excluded": sum(row["year"] == "2024" and row["region_type"] in {"city_police", "railway", "other_police_unit"} for row in source_rows),
                       "aggregate_observations_excluded": sum(row["year"] == "2024" and row["comparison_status"] == "aggregate_only" for row in source_rows),
                       "duplicate_observations_excluded": sum(row["year"] == "2024" and row["quality_status"] == "duplicate" for row in source_rows),
                       "official_and_parent_categories_excluded": 23, "null_feature_values": 0,
                       "association_districts_without_items_at_min_cases": len(regions) - assoc["n_transactions"],
                       "2020_partial_source_excluded": True},
        "preprocessing": {"pca_and_clustering": "log1p(count) per feature then population-standard z-score over the 774 verified administrative district cohort; no population rates.",
                          "anomalies_and_association": "Untransformed non-null reported counts; official and parent totals excluded."},
        "parameters": {"pca_components": 2, "kmeans_k": [3,4,5], "kmeans_seed": 42,
                       "hierarchical_linkage": "ward within each state/UT", "hierarchical_max_clusters": 3,
                       "anomaly": {"type": "2024 national cross-sectional", "z_threshold": 2.5},
                       "association": assoc_params, "association_scope": "One transaction per administrative district; item present at reported count >=10."},
        "environment": {"python": platform.python_version(), "numpy": np.__version__, "code_commit": commit,
                        "code_file_hashes": {path: digest(ROOT / path) for path in code_files}},
        "validation": {"feature_keys_unique": True, "selected_values_source_clean_match": True,
                       "pca_ids_and_variance_valid": True, "kmeans_assignments_cover_all_regions": True,
                       "hierarchical_ids_cover_state_cohorts": True, "association_transactions": assoc["n_transactions"],
                       "association_sensitivity": sensitivity},
        "methods": methods,
        "artifacts": {str(path.relative_to(run_dir)).replace("\\", "/"): digest(path) for path in output_files},
        "supersedes_run": "ncrb-national-2024-admin-log1p-zscore-20261106-v3",
    }
    (run_dir / "run_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"run_id": args.run_id, "regions": len(regions), "features": len(feature_defs),
                      "pca_variance": pca["explained_variance_ratio"], "association_transactions": assoc["n_transactions"],
                      "association_rules": assoc["n_rules"], "hierarchical_state_runs": len(hierarchical_artifacts)}, indent=2))


if __name__ == "__main__":
    main()

