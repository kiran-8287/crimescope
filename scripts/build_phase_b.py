"""Phase B vertical slice: build canonical dataset from one verified 2020 table."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "analysis" / "src"))

from crimescope_analysis.cleaning.canonical import parse_table, write_observations, build_row_accounting  # noqa: E402


SOURCE_CSV = Path("data/raw/2020/1_districtwise-crime-against-children-2020_t1.csv")
OUTPUT_CSV = Path("data/processed/crime_observations_2020.csv")
ACCOUNTING_JSON = Path("data/processed/row_accounting_2020.json")
SOURCE_ID = "cii_2020_1_districtwise-crime-against-children_t1"
YEAR = 2020


def main() -> int:
    if not SOURCE_CSV.exists():
        print(f"Source file not found: {SOURCE_CSV}", file=sys.stderr)
        return 1

    print(f"Parsing {SOURCE_CSV}")
    observations = parse_table(SOURCE_CSV, YEAR, SOURCE_ID)

    print(f"Writing {len(observations)} canonical observations to {OUTPUT_CSV}")
    write_observations(observations, OUTPUT_CSV)

    accounting = build_row_accounting(SOURCE_CSV, observations)
    ACCOUNTING_JSON.parent.mkdir(parents=True, exist_ok=True)
    with ACCOUNTING_JSON.open("w", encoding="utf-8") as f:
        json.dump(accounting, f, indent=2)

    print(json.dumps(accounting, indent=2))
    print(f"Phase B data build complete: {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
