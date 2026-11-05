"""Print the raw and canonical values for two release sanity-check records."""
import csv
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "data/interim/expanded_national_2021_2024"
db = sqlite3.connect(STAGE / "crimescope.sqlite")
manifest = json.loads((STAGE / "source_selection_manifest.json").read_text(encoding="utf-8"))
template = next(csv.reader((ROOT / "data/raw/2024/districtwise_ipc_bns_fragments/1_1districtwiseipccrimes2024_t1.csv").open(encoding="utf-8-sig")))
taxonomy = json.loads((ROOT / "config/category_hierarchy.json").read_text(encoding="utf-8"))
cases = [
    ("Arunachal Pradesh", "Anjaw", "Rape", "2024"),
    ("Andhra Pradesh", "Anantapuramu", "Murder BNS /Section 302 IPC)", "2024"),
]
for state, region, category, year in cases:
    record = db.execute(
        "SELECT reported_value,source_id,source_row_reference,category_id FROM crime_observations "
        "WHERE year=? AND state_name=? AND region_name=? AND original_category=? "
        "AND region_type='administrative_district' AND comparison_status='eligible'",
        (int(year), state, region, category),
    ).fetchone()
    if record is None:
        raise SystemExit(f"Missing canonical record: {state}/{region}/{category}")
    fragment = next(x for x in manifest["years"][year] if x["table_id"] == record[1])
    path = ROOT / fragment["path"]
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        next(reader)
        row_num = int(record[2].split("_")[1])
        row = next(r for i, r in enumerate(reader, start=2) if i == row_num)
    source_header = next(c for c in taxonomy["categories"] if c["id"] == record[3])["sourceHeaders"][year][0]
    category_column = template.index(source_header)
    if row[2] != region or int(row[category_column]) != record[0]:
        raise SystemExit(f"Raw/source mismatch for {state}/{region}/{category}: {row[2]}, {row[category_column]}, {record[0]}")
    print(json.dumps({"state": state, "district": region, "category": category,
                      "value": record[0], "raw_fragment": fragment["path"],
                      "raw_line": row_num, "category_column": category_column + 1,
                      "source_id": record[1]}, ensure_ascii=False))
