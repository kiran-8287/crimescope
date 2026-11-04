"""Build SQLite serving release from canonical processed data."""

from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

PROCESSED_CSV = Path("data/processed/crime_observations_2020.csv")
RELEASE_DIR = Path("data/serving/releases/2020_cci_district_children")
SQLITE_PATH = RELEASE_DIR / "crimescope.sqlite"
MANIFEST_PATH = RELEASE_DIR / "release_manifest.json"
CURRENT_JSON = Path("data/serving/current.json")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    if not PROCESSED_CSV.exists():
        print(f"Processed CSV not found: {PROCESSED_CSV}", file=sys.stderr)
        return 1

    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    if SQLITE_PATH.exists():
        SQLITE_PATH.unlink()

    conn = sqlite3.connect(str(SQLITE_PATH))
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE crime_observations (
            observation_id TEXT PRIMARY KEY,
            year INTEGER,
            state_id TEXT,
            state_name TEXT,
            geography_id TEXT,
            region_name TEXT,
            original_region_name TEXT,
            region_type TEXT,
            geography_version TEXT,
            category_id TEXT,
            original_category TEXT,
            measure_type TEXT,
            unit TEXT,
            reported_value INTEGER,
            missing_reason TEXT,
            law_framework TEXT,
            source_id TEXT,
            source_row_reference TEXT,
            quality_status TEXT,
            comparison_status TEXT
        )
        """
    )

    cur.execute(
        "CREATE INDEX idx_observations_year_region ON crime_observations(year, region_name)"
    )
    cur.execute(
        "CREATE INDEX idx_observations_year_category ON crime_observations(year, category_id)"
    )
    cur.execute(
        "CREATE INDEX idx_observations_state_region ON crime_observations(state_name, region_name)"
    )

    rows_inserted = 0
    with PROCESSED_CSV.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cur.execute(
                """
                INSERT INTO crime_observations (
                    observation_id, year, state_id, state_name, geography_id,
                    region_name, original_region_name, region_type, geography_version,
                    category_id, original_category, measure_type, unit,
                    reported_value, missing_reason, law_framework, source_id,
                    source_row_reference, quality_status, comparison_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["observation_id"],
                    int(row["year"]),
                    row["state_id"],
                    row["state_name"],
                    row["geography_id"],
                    row["region_name"],
                    row["original_region_name"],
                    row["region_type"],
                    row["geography_version"],
                    row["category_id"],
                    row["original_category"],
                    row["measure_type"],
                    row["unit"],
                    int(row["reported_value"]) if row["reported_value"] else None,
                    row["missing_reason"] or None,
                    row["law_framework"],
                    row["source_id"],
                    row["source_row_reference"],
                    row["quality_status"],
                    row["comparison_status"],
                ),
            )
            rows_inserted += 1

    conn.commit()

    # Verify counts
    cur.execute("SELECT COUNT(*) FROM crime_observations")
    db_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT region_name) FROM crime_observations WHERE comparison_status='eligible'")
    region_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT original_category) FROM crime_observations WHERE comparison_status='eligible'")
    category_count = cur.fetchone()[0]
    cur.execute("SELECT SUM(reported_value) FROM crime_observations WHERE comparison_status='eligible' AND region_type='aggregate'")
    total_cases = cur.fetchone()[0] or 0

    conn.close()

    sqlite_hash = sha256_file(SQLITE_PATH)
    csv_hash = sha256_file(PROCESSED_CSV)

    manifest = {
        "release_id": "2020_cci_district_children",
        "release_type": "phase_b_vertical_slice",
        "created_at": "2026-11-04T00:00:00Z",
        "source_table": "data/raw/2020/1_districtwise-crime-against-children-2020_t1.csv",
        "source_id": "cii_2020_1_districtwise-crime-against-children_t1",
        "year": 2020,
        "sqlite_path": str(SQLITE_PATH),
        "sqlite_sha256": sqlite_hash,
        "csv_sha256": csv_hash,
        "row_count": db_count,
        "eligible_regions": region_count,
        "eligible_categories": category_count,
        "total_cases_aggregate": total_cases,
        "description": "Phase B vertical slice: one verified NCRB 2020 district-wise crimes-against-children table",
    }

    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    current = {
        "release_id": manifest["release_id"],
        "release_path": str(RELEASE_DIR),
        "sqlite_path": str(SQLITE_PATH),
        "year": 2020,
    }
    CURRENT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with CURRENT_JSON.open("w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)

    print(json.dumps(manifest, indent=2))
    print(f"\nSQLite release built: {SQLITE_PATH} ({db_count} rows)")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Current release pointer: {CURRENT_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
