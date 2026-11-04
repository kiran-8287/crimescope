"""Phase C: Build canonical multi-year dataset with cleaning, mapping, quarantine, quality report."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "analysis" / "src"))

from crimescope_analysis.cleaning.canonical import (  # noqa: E402
    apply_mappings,
    build_quality_report,
    build_row_accounting,
    detect_duplicates,
    load_category_mapping,
    load_geography_mapping,
    parse_table,
    validate_totals,
    write_observations,
)

SOURCES = [
    {"year": 2020, "source_id": "cii_2020_1_districtwise-ipc-crimes_t1", "path": "data/raw/2020/1_districtwise-ipc-crimes-2020_t1.csv"},
    {"year": 2021, "source_id": "cii_2021_1_districtwise-ipc-crimes_t1", "path": "data/raw/2021/1_16730065601districtwiseipccrimes2021_t1.csv"},
    {"year": 2022, "source_id": "cii_2022_1_districtwise-ipc-crimes_t1", "path": "data/raw/2022/1_17016833111districtwiseipccrimes2022_t1.csv"},
    {"year": 2023, "source_id": "cii_2023_1_districtwise-ipc-crimes_t1", "path": "data/raw/2023/1_1districtwiseipccrimes20231_t1.csv"},
    {"year": 2024, "source_id": "cii_2024_1_districtwise-ipc-crimes_t1", "path": "data/raw/2024/1_1districtwiseipccrimes2024_t1.csv"},
]

OUTPUT_DIR = Path("data/processed")
ALL_OBSERVATIONS_PATH = OUTPUT_DIR / "crime_observations_multi_year.csv"
QUARANTINE_PATH = OUTPUT_DIR / "quarantined_observations.csv"
QUALITY_REPORT_PATH = OUTPUT_DIR / "quality_report.json"
ROW_ACCOUNTING_DIR = OUTPUT_DIR / "row_accounting"

GEO_MAPPING_PATH = Path("data/mappings/geography_crosswalk.csv")
CAT_MAPPING_PATH = Path("data/mappings/category_crosswalk.csv")


def main() -> int:
    geo_mapping = load_geography_mapping(GEO_MAPPING_PATH)
    cat_mapping = load_category_mapping(CAT_MAPPING_PATH)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ROW_ACCOUNTING_DIR.mkdir(parents=True, exist_ok=True)

    all_observations: list = []
    all_accounting: dict = {}

    for src in SOURCES:
        csv_path = Path(src["path"])
        if not csv_path.exists():
            print(f"WARNING: source file not found: {csv_path}", file=sys.stderr)
            continue

        print(f"Processing {csv_path} (year={src['year']})")
        observations = parse_table(csv_path, src["year"], src["source_id"])
        observations = apply_mappings(observations, geo_mapping, cat_mapping)
        observations = detect_duplicates(observations)
        observations = validate_totals(observations)

        accounting = build_row_accounting(csv_path, observations)
        all_accounting[src["source_id"]] = accounting

        # Per-year accounting file
        acct_path = ROW_ACCOUNTING_DIR / f"row_accounting_{src['year']}.json"
        with acct_path.open("w", encoding="utf-8") as f:
            json.dump(accounting, f, indent=2)

        print(json.dumps(accounting, indent=2))
        all_observations.extend(observations)

    total_observations = len(all_observations)
    total_quarantined = sum(1 for o in all_observations if o.quarantine_reason is not None)
    total_duplicates = sum(1 for o in all_observations if o.quality_status == "duplicate")
    total_totals_mismatch = sum(1 for o in all_observations if o.quality_status == "totals_mismatch")

    print(f"\nWriting {total_observations} canonical observations to {ALL_OBSERVATIONS_PATH}")
    write_observations(all_observations, ALL_OBSERVATIONS_PATH)

    quarantined = [o for o in all_observations if o.quarantine_reason is not None]
    if quarantined:
        print(f"Writing {len(quarantined)} quarantined observations to {QUARANTINE_PATH}")
        write_observations(quarantined, QUARANTINE_PATH)

    report = build_quality_report(
        all_accounting,
        total_observations,
        total_quarantined,
        total_duplicates,
        total_totals_mismatch,
    )
    with QUALITY_REPORT_PATH.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    print(f"\nPhase C complete: {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
