"""Anomaly detection: cross-sectional profiles and year-on-year changes."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from typing import Optional


def load_feature_matrix(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["total"] = int(row["total"]) if row.get("total") else 0
            row["year"] = int(row["year"])
            if "reported_value" not in row:
                row["reported_value"] = row["total"]
            rows.append(row)
    return rows


def _mean(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0


def _std(vals: list[float]) -> float:
    if len(vals) < 2:
        return 0
    m = _mean(vals)
    return math.sqrt(sum((v - m) ** 2 for v in vals) / (len(vals) - 1))


def cross_sectional_anomalies(
    rows: list[dict],
    year: int,
    z_threshold: float = 2.5,
) -> list[dict]:
    """Flag regions where a category's value deviates from the year's mean by z_threshold std devs."""
    year_rows = [r for r in rows if r["year"] == year and r.get("quality_status") != "duplicate"]

    categories = sorted({r["category"] for r in year_rows})
    regions = sorted({r["region_name"] for r in year_rows})

    anomalies = []
    for cat in categories:
        cat_vals = [r["total"] for r in year_rows if r["category"] == cat]
        if len(cat_vals) < 3:
            continue
        cat_mean = _mean(cat_vals)
        cat_std = _std(cat_vals)
        if cat_std == 0:
            continue

        for r in year_rows:
            if r["category"] != cat:
                continue
            z = (r["total"] - cat_mean) / cat_std
            if abs(z) >= z_threshold:
                anomalies.append(
                    {
                        "year": year,
                        "region": r["region_name"],
                        "region_id": r.get("region_id"),
                        "state_name": r["state_name"],
                        "category": cat,
                        "value": r["total"],
                        "category_mean": round(cat_mean, 2),
                        "category_std": round(cat_std, 2),
                        "z_score": round(z, 4),
                        "anomaly_type": "cross_sectional",
                        "direction": "high" if z > 0 else "low",
                    }
                )

    anomalies.sort(key=lambda a: abs(a["z_score"]), reverse=True)
    return anomalies


def year_on_year_anomalies(
    rows: list[dict],
    pct_threshold: float = 50.0,
) -> list[dict]:
    """Flag region-category pairs with unusual year-over-year changes."""
    changes = {}
    for r in rows:
        if r.get("quality_status") == "duplicate":
            continue
        key = (r["state_name"], r["region_name"], r["category"])
        changes.setdefault(key, []).append(r)

    anomalies = []
    for key, yearly in changes.items():
        yearly.sort(key=lambda r: r["year"])
        for i in range(1, len(yearly)):
            prev = yearly[i - 1]
            curr = yearly[i]
            prev_total = prev["total"]
            curr_total = curr["total"]
            if prev_total == 0:
                continue
            pct_change = ((curr_total - prev_total) / prev_total) * 100
            if abs(pct_change) >= pct_threshold:
                anomalies.append(
                    {
                        "year": curr["year"],
                        "prev_year": prev["year"],
                        "region": curr["region_name"],
                        "state_name": curr["state_name"],
                        "category": curr["category"],
                        "prev_total": prev_total,
                        "curr_total": curr_total,
                        "abs_change": curr_total - prev_total,
                        "pct_change": round(pct_change, 2),
                        "anomaly_type": "year_on_year",
                        "direction": "increase" if pct_change > 0 else "decrease",
                    }
                )

    anomalies.sort(key=lambda a: abs(a["pct_change"]), reverse=True)
    return anomalies


def run_anomaly_detection(
    input_csv: Path,
    output_dir: Path,
    years: list[int],
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = load_feature_matrix(input_csv)

    results = {}
    for year in years:
        cs = cross_sectional_anomalies(rows, year)
        yoy = year_on_year_anomalies(rows)
        year_yoy = [a for a in yoy if a["year"] == year]

        result = {
            "year": year,
            "cross_sectional": cs,
            "year_on_year": year_yoy,
            "cross_sectional_count": len(cs),
            "year_on_year_count": len(year_yoy),
        }
        results[year] = result
        with (output_dir / f"anomalies_{year}.json").open("w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

    all_yoy = year_on_year_anomalies(rows)
    with (output_dir / "anomalies_year_on_year_all.json").open("w", encoding="utf-8") as f:
        json.dump(all_yoy, f, indent=2)

    return {
        "method": "08_anomaly_detection",
        "years_analyzed": years,
        "output_dir": str(output_dir),
    }
