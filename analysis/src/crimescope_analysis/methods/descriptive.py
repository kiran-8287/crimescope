"""Descriptive statistics: frequencies, distributions, central tendency, dispersion."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from typing import Optional


def load_observations(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["reported_value"] = (
                int(row["reported_value"]) if row["reported_value"] else None
            )
            row["year"] = int(row["year"])
            rows.append(row)
    return rows


def _mean(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0


def _median(vals: list[float]) -> float:
    if not vals:
        return 0
    s = sorted(vals)
    n = len(s)
    mid = n // 2
    if n % 2 == 1:
        return s[mid]
    return (s[mid - 1] + s[mid]) / 2


def _std(vals: list[float]) -> float:
    if len(vals) < 2:
        return 0
    m = _mean(vals)
    return math.sqrt(sum((v - m) ** 2 for v in vals) / (len(vals) - 1))


def frequency_by_category(
    observations: list[dict],
    year: Optional[int] = None,
) -> list[dict]:
    """Total cases per category, optionally filtered by year."""
    buckets: dict[tuple, list[int]] = {}
    for obs in observations:
        if obs.get("quality_status") != "valid":
            continue
        if obs.get("comparison_status") != "eligible":
            continue
        if year is not None and obs["year"] != year:
            continue
        cat = obs["original_category"]
        if obs["reported_value"] is None:
            continue
        val = obs["reported_value"]
        buckets.setdefault((obs.get("category_id"), cat), []).append(val)

    result = []
    for category_key, vals in buckets.items():
        cat = category_key[1]
        result.append(
            {
                "category": cat,
                "category_id": category_key[0],
                "year": year or "all",
                "total_cases": sum(vals),
                "observations": len(vals),
                "mean": round(_mean(vals), 4),
                "median": round(_median(vals), 4),
                "std": round(_std(vals), 4),
                "min": min(vals) if vals else 0,
                "max": max(vals) if vals else 0,
            }
        )
    result.sort(key=lambda r: r["total_cases"], reverse=True)
    return result


def frequency_by_region(
    observations: list[dict],
    year: Optional[int] = None,
) -> list[dict]:
    """Total cases per region, optionally filtered by year."""
    buckets: dict[tuple, list[int]] = {}
    for obs in observations:
        if obs.get("quality_status") != "valid":
            continue
        if obs.get("comparison_status") != "eligible":
            continue
        if year is not None and obs["year"] != year:
            continue
        if obs["reported_value"] is None:
            continue
        key = (obs["state_name"], obs.get("geography_id"), obs["region_name"])
        val = obs["reported_value"]
        buckets.setdefault(key, []).append(val)

    result = []
    for (state, region_id, region), vals in buckets.items():
        result.append(
            {
                "region": region,
                "state_name": state,
                "region_id": region_id,
                "year": year or "all",
                "total_cases": sum(vals),
                "observations": len(vals),
                "mean": round(_mean(vals), 4),
                "median": round(_median(vals), 4),
                "std": round(_std(vals), 4),
                "min": min(vals) if vals else 0,
                "max": max(vals) if vals else 0,
            }
        )
    result.sort(key=lambda r: r["total_cases"], reverse=True)
    return result


def distribution_summary(
    observations: list[dict],
    category: str,
    year: Optional[int] = None,
) -> dict:
    """Full distribution summary for one category."""
    vals = []
    regions = []
    for obs in observations:
        if obs.get("quality_status") != "valid":
            continue
        if obs.get("comparison_status") != "eligible":
            continue
        if obs["original_category"] != category:
            continue
        if year is not None and obs["year"] != year:
            continue
        if obs["reported_value"] is not None:
            vals.append(obs["reported_value"])
            regions.append(obs["region_name"])

    if not vals:
        return {
            "category": category,
            "year": year or "all",
            "n": 0,
            "total": 0,
            "mean": 0,
            "median": 0,
            "std": 0,
            "min": 0,
            "max": 0,
            "q1": 0,
            "q3": 0,
            "regions": [],
        }

    s = sorted(vals)
    n = len(s)
    q1 = s[n // 4] if n >= 4 else s[0]
    q3 = s[3 * n // 4] if n >= 4 else s[-1]

    return {
        "category": category,
        "year": year or "all",
        "n": n,
        "total": sum(vals),
        "mean": round(_mean(vals), 4),
        "median": round(_median(vals), 4),
        "std": round(_std(vals), 4),
        "min": min(vals),
        "max": max(vals),
        "q1": q1,
        "q3": q3,
        "regions": sorted(set(regions)),
    }


def run_descriptive_statistics(
    input_csv: Path,
    output_dir: Path,
) -> dict:
    observations = load_observations(input_csv)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Overall frequency by category
    cat_freq = frequency_by_category(observations)
    with (output_dir / "frequency_by_category.json").open("w", encoding="utf-8") as f:
        json.dump(cat_freq, f, indent=2)

    # Frequency by region per year
    for year in sorted({o["year"] for o in observations}):
        reg_freq = frequency_by_region(observations, year=year)
        with (output_dir / f"frequency_by_region_{year}.json").open(
            "w", encoding="utf-8"
        ) as f:
            json.dump(reg_freq, f, indent=2)

    # Category distribution per year
    categories = sorted({o["original_category"] for o in observations if o.get("quality_status") == "valid" and o.get("comparison_status") == "eligible"})
    dist_summaries = []
    for cat in categories[:20]:  # top 20 categories to keep output bounded
        for year in sorted({o["year"] for o in observations}):
            dist_summaries.append(distribution_summary(observations, cat, year=year))
    with (output_dir / "distribution_summaries.json").open("w", encoding="utf-8") as f:
        json.dump(dist_summaries, f, indent=2)

    return {
        "input_observations": len(observations),
        "categories_analyzed": len(cat_freq),
        "years_covered": sorted({o["year"] for o in observations}),
        "output_dir": str(output_dir),
    }
