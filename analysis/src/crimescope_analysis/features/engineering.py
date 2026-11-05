"""Feature engineering: counts, shares, rates, cohorts, transformations."""

from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path
from typing import Optional


def load_observations(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["year"] = int(row["year"])
            value = row.get("reported_value", "")
            row["reported_value"] = int(value) if value not in ("", None) else None
            row["total"] = row["reported_value"]
            rows.append(row)
    return rows


def stable_id(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:24]


def aggregate_by_region_year(
    observations: list[dict],
    category: Optional[str] = None,
) -> list[dict]:
    """Keep one region-ID/category/year row and preserve missing cells as null."""
    buckets: dict[tuple, dict] = {}
    for obs in observations:
        if obs.get("quality_status") != "valid" or obs.get("comparison_status") != "eligible":
            continue
        if category and obs["original_category"] != category:
            continue
        key = (obs["year"], obs.get("geography_id"), obs["state_name"], obs["region_name"], obs["category_id"])
        if key not in buckets:
            buckets[key] = {
                "year": obs["year"], "state_name": obs["state_name"], "region_name": obs["region_name"],
                "region_id": obs.get("geography_id"), "region_type": obs["region_type"],
                "geography_version": obs.get("geography_version"), "law_framework": obs.get("law_framework"),
                "category": obs["original_category"], "category_id": obs["category_id"], "values": [],
            }
        if obs["reported_value"] is not None:
            buckets[key]["values"].append(obs["reported_value"])

    result: list[dict] = []
    for bucket in buckets.values():
        values = bucket["values"]
        bucket["total"] = sum(values) if values else None
        bucket["count"] = len(values)
        bucket["mean"] = round(sum(values) / len(values), 4) if values else None
        del bucket["values"]
        result.append(bucket)
    return result

def compute_shares(region_year_rows: list[dict]) -> list[dict]:
    """Shares are unavailable until a mutually exclusive category set is verified."""
    return [{**row, "share_of_region_total": None} for row in region_year_rows]

def compute_year_change(region_year_rows: list[dict]) -> list[dict]:
    """Compute changes only inside state cohorts with exact unit/category sets and same law."""
    allowed_pairs = [(2020, 2021), (2021, 2022), (2022, 2023)]
    by_state_year: dict[tuple[str, int], list[dict]] = {}
    for row in region_year_rows:
        by_state_year.setdefault((row["state_name"], row["year"]), []).append(row)
    results: list[dict] = []
    for from_year, to_year in allowed_pairs:
        states = {state for state, year in by_state_year if year == from_year} & {state for state, year in by_state_year if year == to_year}
        for state in sorted(states):
            previous = by_state_year[(state, from_year)]
            current = by_state_year[(state, to_year)]
            units_prev = {(r["region_type"], r["region_name"]) for r in previous}
            units_curr = {(r["region_type"], r["region_name"]) for r in current}
            cats_prev = {r["category_id"] for r in previous}
            cats_curr = {r["category_id"] for r in current}
            frameworks = {r["law_framework"] for r in previous + current}
            if units_prev != units_curr or cats_prev != cats_curr or len(frameworks) != 1:
                continue
            prev_map = {(r["region_type"], r["region_name"], r["category_id"]): r for r in previous}
            curr_map = {(r["region_type"], r["region_name"], r["category_id"]): r for r in current}
            for key in sorted(prev_map.keys() & curr_map.keys()):
                prev, curr = prev_map[key], curr_map[key]
                if prev["total"] is None or curr["total"] is None:
                    continue
                absolute = curr["total"] - prev["total"]
                results.append({"year": to_year, "prev_year": from_year, "state_name": state,
                                "region_type": curr["region_type"], "region_name": curr["region_name"],
                                "region_id": curr["region_id"], "prev_region_id": prev["region_id"],
                                "category": curr["category"], "category_id": curr["category_id"],
                                "law_framework": curr["law_framework"], "prev_total": prev["total"],
                                "curr_total": curr["total"], "abs_change": absolute,
                                "pct_change": round((absolute / prev["total"]) * 100, 4) if prev["total"] else None})
    return results

def run_feature_engineering(
    input_csv: Path,
    output_csv: Path,
) -> dict:
    observations = load_observations(input_csv)
    region_year_rows = aggregate_by_region_year(observations)
    region_year_rows = compute_shares(region_year_rows)
    year_changes = compute_year_change(region_year_rows)

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "year", "state_name", "region_name", "region_id", "region_type", "geography_version", "law_framework",
        "category", "category_id", "total", "count", "mean", "share_of_region_total",
    ]
    with output_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in region_year_rows:
            writer.writerow({k: row.get(k) for k in fields})

    changes_csv = output_csv.with_name(output_csv.stem + "_year_change.csv")
    changes_fields = [
        "year", "prev_year", "state_name", "region_type", "region_name", "region_id", "prev_region_id",
        "category", "category_id", "law_framework", "prev_total", "curr_total", "abs_change", "pct_change",
    ]
    with changes_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=changes_fields)
        writer.writeheader()
        for row in year_changes:
            writer.writerow(row)

    return {
        "input_observations": len(observations),
        "region_year_rows": len(region_year_rows),
        "year_change_rows": len(year_changes),
        "output_csv": str(output_csv),
        "changes_csv": str(changes_csv),
    }
