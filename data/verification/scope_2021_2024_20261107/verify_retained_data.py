"""Scope-change verification: prove retained 2021-2024 data is unchanged and 2020 is gone.

Compares the active canonical dataset (rebuilt_national_2021_2024_v3) against the
previous release's canonical dataset (expanded_national_2021_2024) restricted to
2021-2024, using a stable source-observation identity and explicit key-uniqueness
checks. Writes a JSON result to the same directory.
"""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent

NEW_CSV = ROOT / "data/interim/rebuilt_national_2021_2024_v3/crime_observations_multi_year.csv"
OLD_CSV = ROOT / "data/interim/expanded_national_2021_2024/crime_observations_multi_year.csv"
NEW_SQLITE = ROOT / "data/serving/releases/ncrb-districtwise-2021-2024-ecec48b772bc/crimescope.sqlite"
OLD_SQLITE = ROOT / "data/serving/releases/ncrb-districtwise-2021-2024-fd2d8578be56/crimescope.sqlite"

RETAINED_YEARS = {"2021", "2022", "2023", "2024"}
KEY_FIELDS = ("year", "source_id", "source_row_reference", "category_id")
COMPARE_FIELDS = (
    "reported_value", "missing_reason", "law_framework", "quality_status",
    "comparison_status", "quarantine_reason", "region_type", "original_category",
    "state_name", "region_name", "geography_id", "observation_id",
)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def key_of(row):
    return tuple(row[f] for f in KEY_FIELDS)


def blank_to_none(value: str):
    return None if value == "" else value


def main() -> int:
    result: dict = {"new_csv": str(NEW_CSV.relative_to(ROOT)), "old_csv": str(OLD_CSV.relative_to(ROOT))}

    result["hashes"] = {
        "new_csv_sha256": sha256(NEW_CSV),
        "old_csv_sha256": sha256(OLD_CSV),
        "new_sqlite_sha256": sha256(NEW_SQLITE),
        "old_sqlite_sha256": sha256(OLD_SQLITE),
    }

    new_rows = load(NEW_CSV)
    old_all = load(OLD_CSV)
    old_rows = [r for r in old_all if r["year"] in RETAINED_YEARS]

    # --- scope assertions ---
    new_years = Counter(r["year"] for r in new_rows)
    old_years = Counter(r["year"] for r in old_all)
    result["new_year_counts"] = dict(sorted(new_years.items()))
    result["old_year_counts"] = dict(sorted(old_years.items()))
    result["new_has_2020"] = "2020" in new_years
    result["old_2020_rows"] = old_years.get("2020", 0)

    # --- key uniqueness ---
    new_key_counts = Counter(key_of(r) for r in new_rows)
    old_key_counts = Counter(key_of(r) for r in old_rows)
    result["new_key_unique"] = all(v == 1 for v in new_key_counts.values())
    result["old_retained_key_unique"] = all(v == 1 for v in old_key_counts.values())
    result["new_duplicate_keys"] = sum(v - 1 for v in new_key_counts.values() if v > 1)
    result["old_retained_duplicate_keys"] = sum(v - 1 for v in old_key_counts.values() if v > 1)

    new_map = {key_of(r): r for r in new_rows}
    old_map = {key_of(r): r for r in old_rows}

    new_keys, old_keys = set(new_map), set(old_map)
    matched = new_keys & old_keys
    added = new_keys - old_keys
    removed = old_keys - new_keys

    result["counts"] = {
        "new_rows_total": len(new_rows),
        "old_rows_total_all_years": len(old_all),
        "old_rows_retained_2021_2024": len(old_rows),
        "new_unique_keys": len(new_keys),
        "old_retained_unique_keys": len(old_keys),
        "matched": len(matched),
        "added_in_new": len(added),
        "removed_from_old": len(removed),
    }

    # --- field-level comparison on matched records ---
    changed_values = []
    null_to_zero, zero_to_null = [], []
    field_changes = Counter()
    other_field_examples: dict[str, list] = {}
    for key in matched:
        old_row, new_row = old_map[key], new_map[key]
        for field in COMPARE_FIELDS:
            old_val, new_val = blank_to_none(old_row[field]), blank_to_none(new_row[field])
            if old_val != new_val:
                field_changes[field] += 1
                if field == "reported_value":
                    changed_values.append({"key": key, "old": old_val, "new": new_val})
                    if old_val is None and new_val == "0":
                        null_to_zero.append(key)
                    if old_val == "0" and new_val is None:
                        zero_to_null.append(key)
                else:
                    other_field_examples.setdefault(field, []).append({"key": list(key), "old": old_val, "new": new_val})

    result["value_comparison"] = {
        "matched_value_changes": len(changed_values),
        "null_to_zero": len(null_to_zero),
        "zero_to_null": len(zero_to_null),
        "changed_value_examples": changed_values[:10],
        "field_change_counts": dict(field_changes),
        "non_value_field_examples": {k: v[:5] for k, v in other_field_examples.items()},
    }

    # --- eligibility / classification checks ---
    result["classification"] = {
        "new_region_types": dict(sorted(Counter(r["region_type"] for r in new_rows).items())),
        "old_retained_region_types": dict(sorted(Counter(r["region_type"] for r in old_rows).items())),
        "new_comparison_status": dict(sorted(Counter(r["comparison_status"] for r in new_rows).items())),
        "old_retained_comparison_status": dict(sorted(Counter(r["comparison_status"] for r in old_rows).items())),
        "new_quality_status": dict(sorted(Counter(r["quality_status"] for r in new_rows).items())),
        "old_retained_quality_status": dict(sorted(Counter(r["quality_status"] for r in old_rows).items())),
    }

    # --- quality scope accounting (explicit, non-mixed scopes) ---
    def scope_stats(rows):
        all_scope = rows
        eligible = [r for r in rows if r["comparison_status"] == "eligible"]
        eligible_non_agg = [r for r in eligible if r["region_type"] != "aggregate"]
        aggregate = [r for r in rows if r["region_type"] == "aggregate" or r["comparison_status"] == "aggregate_only"]
        # Aggregate rows carry an exclusion note in quarantine_reason; defects are separate.
        quarantined = [r for r in rows
                       if (r["quarantine_reason"] and r["comparison_status"] != "aggregate_only")
                       or r["quality_status"] in {"duplicate", "totals_mismatch"}]

        def zeros(rs):
            return sum(1 for r in rs if r["reported_value"] == "0")

        def nulls(rs):
            return sum(1 for r in rs if r["reported_value"] == "")

        return {
            "all_rows": len(all_scope), "all_zeros": zeros(all_scope), "all_nulls": nulls(all_scope),
            "eligible_rows": len(eligible), "eligible_zeros": zeros(eligible), "eligible_nulls": nulls(eligible),
            "eligible_non_aggregate_rows": len(eligible_non_agg),
            "eligible_non_aggregate_zeros": zeros(eligible_non_agg),
            "eligible_non_aggregate_nulls": nulls(eligible_non_agg),
            "aggregate_rows": len(aggregate), "aggregate_zeros": zeros(aggregate), "aggregate_nulls": nulls(aggregate),
            "quarantined_rows": len(quarantined),
        }

    result["quality_scopes"] = {
        "new": scope_stats(new_rows),
        "old_retained_2021_2024": scope_stats(old_rows),
        "old_all_years": scope_stats(old_all),
    }

    # --- additional preserved source checks ---
    def find(rows, state, region, category, year):
        for r in rows:
            if r["state_name"] == state and r["region_name"] == region and year == r["year"] \
               and (category in r["original_category"] or category in r["category_id"]):
                return {"reported_value": r["reported_value"], "category": r["original_category"],
                        "quality_status": r["quality_status"], "comparison_status": r["comparison_status"]}
        return None

    result["source_checks"] = {
        "anjaw_arunachal_rape_2024": find(new_rows, "Arunachal Pradesh", "Anjaw", "Rape", "2024"),
        "anantapuramu_ap_murder_2024": find(new_rows, "Andhra Pradesh", "Anantapuramu", "Murder", "2024"),
    }

    (OUT / "retained_data_comparison.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("hashes", "new_year_counts", "old_year_counts", "counts", "value_comparison", "source_checks")}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
