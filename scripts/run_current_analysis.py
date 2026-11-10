"""Safe, parameterized CURRENT reproduction runner.

This is the "run against what the app actually serves" entry point. It resolves
the method input from the ACTIVE serving release pointer
(``data/serving/current.json`` -> ``release_manifest.json`` -> ``source_dataset``)
rather than from any hard-coded staging directory, validates the resolved CSV's
sha256 against that release manifest, and checks that the 2024 method cohort is
clean and matches the active run manifest.

Guarantees:
  * Reads the selected source explicitly (no hard-coded stale path).
  * Validates the source dataset sha256 against the active release manifest.
  * Requires a FRESH output directory and REFUSES to overwrite an existing run.
  * NEVER writes or updates any pointer file (never edits
    ``analysis/output/runs/current.json`` or ``data/serving/current.json``).

Modes:
  * ``--dry-run`` (default): resolve + validate only. Writes nothing, fits no model.
  * ``--execute --run-id <new-id>``: after the same validation, delegate the
    actual model generation to ``scripts/run_v4_analysis.py`` with the new run id.
    That runner refuses to overwrite an existing run directory, so the output is
    always a fresh, isolated run under ``analysis/output/runs/<run-id>/``.

Examples:
    python scripts/run_current_analysis.py --dry-run
    python scripts/run_current_analysis.py --execute --run-id ncrb-national-2024-admin-log1p-zscore-<stamp>
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

# Reuse the pointer-driven resolution helper from the active v4 pipeline so there
# is exactly one definition of "where does the method input come from".
import run_v4_analysis as v4  # noqa: E402

RELEASE_POINTER = ROOT / "data/serving/current.json"
RUNS_POINTER = ROOT / "analysis/output/runs/current.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def active_run() -> dict:
    """Read the active run pointer + manifest (read-only)."""
    pointer = json.loads(RUNS_POINTER.read_text(encoding="utf-8"))
    manifest_path = ROOT / pointer["manifest"]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    return {"pointer": pointer, "manifest_path": manifest_path, "manifest": manifest}


def cohort_summary(dataset_path: Path, taxonomy_path: Path) -> dict:
    """Select the 2024 administrative-district method cohort and report its shape."""
    taxonomy = json.loads(taxonomy_path.read_text(encoding="utf-8"))
    feature_defs = {
        item["id"]: item
        for item in taxonomy["categories"]
        if "2024" in item["rolesByYear"]
        and set(item["rolesByYear"]["2024"]) & set(taxonomy["pcaFeatureRoles"])
    }
    with dataset_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    cohort = [
        row
        for row in rows
        if row["year"] == "2024"
        and row["region_type"] == "administrative_district"
        and row["quality_status"] == "valid"
        and row["comparison_status"] == "eligible"
        and row["category_id"] in feature_defs
    ]
    regions = sorted({row["geography_id"] for row in cohort})
    keys = Counter((row["geography_id"], row["category_id"]) for row in cohort)
    return {
        "year": 2024,
        "region_type": "administrative_district",
        "regions": len(regions),
        "features": len(feature_defs),
        "rows": len(cohort),
        "duplicate_keys": sum(1 for count in keys.values() if count != 1),
        "null_values": sum(1 for row in cohort if row["reported_value"] == ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--taxonomy", default=str(v4.TAXONOMY), help="Category hierarchy JSON.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve + validate only (this is also the default when --execute is absent).",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Generate methods into a NEW isolated run directory (delegates to run_v4_analysis.py).",
    )
    parser.add_argument(
        "--run-id",
        default=None,
        help="New run id; required with --execute and must not already exist.",
    )
    args = parser.parse_args()
    if args.execute and args.dry_run:
        parser.error("--dry-run and --execute are mutually exclusive")
    if args.execute == (args.run_id is None):
        parser.error("--execute requires --run-id, and --run-id is only used together with --execute")

    # 1) resolve the source from the active release pointer (no hard-coded path).
    dataset_path, expected_sha = v4.active_release_source()
    if not dataset_path.is_file():
        raise SystemExit(f"Resolved source dataset not found: {dataset_path}")
    actual_sha = sha256_file(dataset_path)
    if actual_sha != expected_sha:
        raise SystemExit(
            "Source dataset sha256 does not match the active release manifest: "
            f"expected {expected_sha}, got {actual_sha} ({dataset_path})"
        )

    # 2) resolve + validate the cohort and cross-check the active run manifest.
    run = active_run()
    summary = cohort_summary(dataset_path, Path(args.taxonomy))
    manifest = run["manifest"]
    feature_input = manifest.get("feature_input", {})
    manifest_cohort = {
        "regions": feature_input.get("regions"),
        "features": feature_input.get("features"),
        "rows": feature_input.get("rows"),
    }
    if all(value is not None for value in manifest_cohort.values()) and any(
        summary[key] != manifest_cohort[key] for key in manifest_cohort
    ):
        raise SystemExit(
            "Resolved cohort does not match the active run manifest: "
            f"resolved {summary} vs manifest {manifest_cohort}"
        )
    if summary["duplicate_keys"] or summary["null_values"]:
        raise SystemExit(f"Selected method cohort is not clean: {summary}")

    run_dataset_sha = manifest.get("dataset", {}).get("sha256")
    if run_dataset_sha and run_dataset_sha != expected_sha:
        raise SystemExit(
            "Active run manifest dataset hash differs from the active release manifest: "
            f"{run_dataset_sha} != {expected_sha}"
        )

    plan = {
        "mode": "execute" if args.execute else "dry-run",
        "source_dataset": {
            "path": str(dataset_path.relative_to(ROOT)).replace("\\", "/"),
            "sha256": actual_sha,
            "matches_active_release_manifest": True,
        },
        "active_release": json.loads(RELEASE_POINTER.read_text(encoding="utf-8")),
        "active_run": {
            "run_id": run["pointer"]["run_id"],
            "dataset_path": manifest.get("dataset", {}).get("path"),
            "dataset_matches_active_release": run_dataset_sha == expected_sha,
        },
        "cohort": summary,
    }
    print(json.dumps(plan, indent=2))

    if not args.execute:
        print(
            "\nDRY RUN complete: source + cohort resolved and verified against both the "
            "active release manifest and the active run manifest. Nothing was written; "
            "no model was fitted."
        )
        return 0

    run_dir = ROOT / "analysis/output/runs" / args.run_id
    if run_dir.exists():
        raise SystemExit(f"Refusing to overwrite existing run directory: {run_dir}")
    print(
        f"\nExecuting model generation into the NEW run directory {run_dir} via "
        "scripts/run_v4_analysis.py ..."
    )
    subprocess.run(
        [sys.executable, str(SCRIPTS / "run_v4_analysis.py"), "--run-id", args.run_id],
        cwd=ROOT,
        check=True,
    )
    print(f"\nDone. New isolated run: {run_dir}\nNo pointer file was written or updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
