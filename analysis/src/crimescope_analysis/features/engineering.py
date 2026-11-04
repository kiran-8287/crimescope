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
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["total"] = int(row["total"]) if row.get("total") else 0
            row["year"] = int(row["year"])
            # Normalize: use reported_value as alias for total if present
            if "reported_value" not in row:
                row["reported_value"] = row["total"]
            rows.append(row)
    return rows


def stable_id(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:24]


def aggregate_by_region_year(
    observations: list[dict],
    category: Optional[str] = None,
) -> list[dict]:
    """Aggregate observations to one row per (year, state, region, category)."""
    buckets: dict[tuple, dict] = {}
    for obs in observations:
        if obs.get("quality_status") != "valid":
            continue
        if obs.get("comparison_status") != "eligible":
            continue
        if category and obs["original_category"] != category:
            continue
        key = (obs["year"], obs["state_name"], obs["region_name"], obs["original_category"])
        if key not in buckets:
            buckets[key] = {
                "year": obs["year"],
                "state_name": obs["state_name"],
                "region_name": obs["region_name"],
                "region_type": obs["region_type"],
                "category": obs["original_category"],
                "category_id": obs["category_id"],
                "values": [],
            }
        if obs["reported_value"] is not None:
            buckets[key]["values"].append(obs["reported_value"])

    result: list[dict] = []
    for b in buckets.values():
        vals = b["values"]
        b["total"] = sum(vals) if vals else 0
        b["count"] = len(vals)
        b["mean"] = round(sum(vals) / len(vals), 4) if vals else 0
        result.append(b)
    return result


def compute_shares(
    region_year_rows: list[dict],
) -> list[dict]:
    """Compute each category's share of total cases within a (year, region)."""
    groups: dict[tuple, list[dict]] = {}
    for row in region_year_rows:
        key = (row["year"], row["state_name"], row["region_name"])
        groups.setdefault(key, []).append(row)

    result: list[dict] = []
    for key, rows in groups.items():
        total = sum(r["total"] for r in rows)
        for r in rows:
            r2 = dict(r)
            r2["share_of_region_total"] = round(r["total"] / total, 6) if total else 0
            result.append(r2)
    return result


def compute_year_change(
    region_year_rows: list[dict],
) -> list[dict]:
    """Compute year-over-year change for each (region, category)."""
    groups: dict[tuple, dict] = {}
    for row in region_year_rows:
        key = (row["state_name"], row["region_name"], row["category"])
        groups.setdefault(key, []).append(row)

    result: list[dict] = []
    for key, rows in groups.items():
        rows_sorted = sorted(rows, key=lambda r: r["year"])
        for i in range(1, len(rows_sorted)):
            prev = rows_sorted[i - 1]
            curr = rows_sorted[i]
            prev_total = prev["total"]
            curr_total = curr["total"]
            abs_change = curr_total - prev_total
            pct_change = round((abs_change / prev_total) * 100, 4) if prev_total else None
            result.append(
                {
                    "year": curr["year"],
                    "prev_year": prev["year"],
                    "state_name": curr["state_name"],
                    "region_name": curr["region_name"],
                    "category": curr["category"],
                    "prev_total": prev_total,
                    "curr_total": curr_total,
                    "abs_change": abs_change,
                    "pct_change": pct_change,
                }
            )
    return result


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
        "year", "state_name", "region_name", "region_type",
        "category", "category_id", "total", "count", "mean",
        "share_of_region_total",
    ]
    with output_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in region_year_rows:
            writer.writerow({k: row.get(k) for k in fields})

    changes_csv = output_csv.with_name(output_csv.stem + "_year_change.csv")
    changes_fields = [
        "year", "prev_year", "state_name", "region_name",
        "category", "prev_total", "curr_total", "abs_change", "pct_change",
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
