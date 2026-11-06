"""Build and validate a SQLite candidate from an already staged canonical CSV.

This script never changes the active serving pointer; publication is a separate step.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage-dir", default="data/interim/rebuilt_national_2021_2024_v3")
    args = parser.parse_args()
    stage = Path(args.stage_dir)
    if not stage.is_absolute():
        stage = ROOT / stage
    csv_path = stage / "crime_observations_multi_year.csv"
    quality_path = stage / "quality_report.json"
    if not csv_path.is_file() or not quality_path.is_file():
        raise SystemExit("Stage CSV or quality report is missing")
    dataset_hash = sha256(csv_path)
    release_id = f"ncrb-districtwise-2021-2024-{dataset_hash[:12]}"
    db_path = stage / "crimescope.sqlite"
    if db_path.exists():
        raise SystemExit(f"Refusing to overwrite staged database: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=DELETE")
    conn.execute("PRAGMA synchronous=FULL")
    conn.execute("""CREATE TABLE crime_observations (
        observation_id TEXT PRIMARY KEY, year INTEGER NOT NULL, state_id TEXT, state_name TEXT NOT NULL,
        geography_id TEXT NOT NULL, region_name TEXT NOT NULL, original_region_name TEXT NOT NULL,
        region_type TEXT NOT NULL, geography_version TEXT NOT NULL, category_id TEXT NOT NULL,
        original_category TEXT NOT NULL, measure_type TEXT NOT NULL, unit TEXT NOT NULL,
        reported_value INTEGER, missing_reason TEXT, law_framework TEXT NOT NULL, source_id TEXT NOT NULL,
        source_row_reference TEXT, quality_status TEXT NOT NULL, comparison_status TEXT NOT NULL,
        quarantine_reason TEXT, mapped_geography_id TEXT, mapped_category_id TEXT
    )""")
    for statement in (
        "CREATE INDEX idx_obs_year_state_type ON crime_observations(year,state_name,region_type)",
        "CREATE INDEX idx_obs_year_category ON crime_observations(year,category_id)",
        "CREATE INDEX idx_obs_state_region_category ON crime_observations(state_name,geography_id,category_id)",
        "CREATE INDEX idx_obs_quality_comparison ON crime_observations(quality_status,comparison_status)",
    ):
        conn.execute(statement)
    columns = ["observation_id","year","state_id","state_name","geography_id","region_name","original_region_name",
               "region_type","geography_version","category_id","original_category","measure_type","unit","reported_value",
               "missing_reason","law_framework","source_id","source_row_reference","quality_status","comparison_status",
               "quarantine_reason","mapped_geography_id","mapped_category_id"]
    insert_sql = f"INSERT INTO crime_observations ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})"
    count = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        batch = []
        for row in reader:
            batch.append(tuple((int(row[name]) if name == "year" else
                                int(row[name]) if name == "reported_value" and row[name] not in ("", None) else
                                None if name == "reported_value" else
                                row[name] if row[name] != "" else None) for name in columns))
            if len(batch) >= 5000:
                conn.executemany(insert_sql, batch); count += len(batch); batch.clear()
        if batch:
            conn.executemany(insert_sql, batch); count += len(batch)
    conn.commit()

    checks = {}
    checks["row_count"] = conn.execute("SELECT COUNT(*) FROM crime_observations").fetchone()[0]
    checks["duplicate_quality_rows"] = conn.execute("SELECT COUNT(*) FROM crime_observations WHERE quality_status='duplicate'").fetchone()[0]
    checks["aggregate_rows"] = conn.execute("SELECT COUNT(*) FROM crime_observations WHERE comparison_status='aggregate_only'").fetchone()[0]
    checks["year_counts"] = {str(year): rows for year, rows in conn.execute("SELECT year,COUNT(*) FROM crime_observations GROUP BY year ORDER BY year")}
    checks["region_counts_by_year_type"] = [list(row) for row in conn.execute("SELECT year,region_type,COUNT(DISTINCT geography_id) FROM crime_observations WHERE comparison_status='eligible' GROUP BY year,region_type ORDER BY year,region_type")]
    checks["distinct_region_names_state_qualified"] = conn.execute("SELECT COUNT(DISTINCT state_name||'|'||region_name) FROM crime_observations WHERE comparison_status='eligible'").fetchone()[0]
    checks["sample_arunachal_2024"] = [list(row) for row in conn.execute("SELECT state_name,region_name,original_category,reported_value FROM crime_observations WHERE year=2024 AND state_name='Arunachal Pradesh' AND region_name='Anjaw' AND region_type='administrative_district' AND original_category='Rape'")]
    checks["sample_ap_2024"] = [list(row) for row in conn.execute("SELECT state_name,region_name,original_category,reported_value FROM crime_observations WHERE year=2024 AND state_name='Andhra Pradesh' AND region_name='Anantapuramu' AND region_type='administrative_district' AND original_category='Murder BNS /Section 302 IPC)'")]
    conn.close()
    if checks["row_count"] != count:
        raise ValueError(f"SQLite row count mismatch: inserted={count}, queried={checks['row_count']}")
    if checks["duplicate_quality_rows"] != 0:
        raise ValueError("Duplicate observations remain in the staged dataset")
    if len(checks["sample_arunachal_2024"]) != 1 or len(checks["sample_ap_2024"]) != 1:
        raise ValueError("Source-to-dataset sample record could not be resolved uniquely")

    report = json.loads(quality_path.read_text(encoding="utf-8"))
    manifest = {
        "release_id": release_id, "status": "staged_validated", "release_type": "expanded_districtwise_ipc_bns",
        "created_at_utc": datetime.now(timezone.utc).isoformat(), "years": [2021,2022,2023,2024],
        "geography_scope": "36 state/UT fragments in 2021-2024",
        "source_dataset": {"path": "data/interim/expanded_national_2021_2024/crime_observations_multi_year.csv", "sha256": dataset_hash},
        "sqlite": {"path": "data/interim/expanded_national_2021_2024/crimescope.sqlite", "sha256": sha256(db_path)},
        "rows": checks["row_count"], "source_files": report["summary"]["total_sources"],
        "valid_observations": report["summary"]["eligible_for_comparison"],
        "excluded_duplicate_observations": report["summary"]["total_duplicates"],
        "quality_report_path": "data/interim/expanded_national_2021_2024/quality_report.json",
        "quality_report_sha256": sha256(quality_path), "validation": checks,
        "category_roles_path": "config/category_hierarchy.json", "category_roles_sha256": sha256(ROOT / "config/category_hierarchy.json"),
    }
    (stage / "staging_release_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
