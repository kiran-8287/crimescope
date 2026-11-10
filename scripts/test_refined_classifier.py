"""Regression check: active release labels match the canonical classifier."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "analysis" / "src"))

from crimescope_analysis.cleaning.canonical import classify_region  # noqa: E402


def test_refined_classifier_matches_active_release() -> None:
    pointer = json.loads((ROOT / "data/serving/current.json").read_text(encoding="utf-8"))
    database = ROOT / pointer["release_path"] / "crimescope.sqlite"
    assert database.is_file(), f"Active release database is missing: {database}"

    with sqlite3.connect(database) as connection:
        rows = connection.execute(
            """
            SELECT DISTINCT year, original_region_name, region_type
            FROM crime_observations
            WHERE comparison_status = 'eligible' AND region_type != 'aggregate'
            ORDER BY year, original_region_name
            """
        ).fetchall()

    assert rows, "The active release contains no eligible reporting-unit names"
    assert {row[0] for row in rows} == {2021, 2022, 2023, 2024}
    mismatches = [
        {"year": year, "name": name, "stored": stored, "classified": classify_region(name)}
        for year, name, stored in rows
        if classify_region(name) != stored
    ]
    assert not mismatches, f"Stored reporting-unit types differ from canonical rules: {mismatches[:20]}"
