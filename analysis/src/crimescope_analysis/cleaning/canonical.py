"""Canonical long-format row emitter for CrimeScope observations."""

from __future__ import annotations

import csv
import hashlib
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional


@dataclass
class Observation:
    observation_id: str
    year: int
    state_id: str
    state_name: str
    geography_id: str
    region_name: str
    original_region_name: str
    region_type: str
    geography_version: str
    category_id: str
    original_category: str
    measure_type: str
    unit: str
    reported_value: Optional[int]
    missing_reason: Optional[str]
    law_framework: str
    source_id: str
    source_row_reference: str
    quality_status: str
    comparison_status: str


STATE_PREFIX = re.compile(r"^State:\s*(.+?)\s*$")
TOTAL_TOKENS = {"total districts", "total", "total districts ", "total districts\t"}


def parse_state_line(raw: str) -> tuple[str, str]:
    """Extract state name from a 'State: <name>' prefix cell."""
    m = STATE_PREFIX.match(raw.strip())
    if m:
        return m.group(1).strip(), "state"
    return raw.strip(), "unknown"


def classify_region(name: str) -> str:
    """Classify a reporting unit by name suffix."""
    lower = name.lower().strip()
    if lower in TOTAL_TOKENS or lower == "":
        return "aggregate"
    if "railway" in lower:
        return "railway"
    if "city" in lower or "urban" in lower:
        return "city_police"
    return "administrative_district"


def stable_id(*parts: str) -> str:
    """Build a stable observation id from parts."""
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:24]


def clean_numeric(token: str) -> tuple[Optional[int], Optional[str]]:
    """Parse a numeric token, returning (value, missing_reason)."""
    if token is None:
        return None, "source_blank"
    t = token.strip()
    if t == "" or t.lower() in {"na", "nr", "n/a", "-", "—", "–", "null", "none"}:
        return None, "not_reported"
    t2 = t.replace(",", "").replace(" ", "")
    if t2 == "":
        return None, "source_blank"
    try:
        return int(t2), None
    except ValueError:
        try:
            return int(float(t2)), None
        except ValueError:
            return None, f"unparseable:{token}"


def parse_table(
    csv_path: Path,
    year: int,
    source_id: str,
    geography_version: str = "ncrb-2020",
) -> list[Observation]:
    """Parse one NCRB district-wise table into canonical observations."""
    observations: list[Observation] = []

    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)

    col_count = len(header)
    current_state: Optional[str] = None

    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row_idx, row in enumerate(reader, start=2):
            if not row or all(c.strip() == "" for c in row):
                continue

            geography_cell = row[0].strip() if len(row) > 0 else ""
            state_name, _ = parse_state_line(geography_cell)
            if state_name and geography_cell.lower().startswith("state:"):
                current_state = state_name

            sl_no = row[1].strip() if len(row) > 1 else ""
            region_name = row[2].strip() if len(row) > 2 else ""
            original_region_name = region_name

            if current_state is None:
                current_state = state_name

            region_type = classify_region(region_name)
            is_total = region_type == "aggregate"

            geography_id = stable_id("geo", current_state or "", region_name, str(year))

            for col_idx in range(3, col_count):
                if col_idx >= len(row):
                    break
                raw_header = header[col_idx] if col_idx < len(header) else f"col_{col_idx}"
                category_part = raw_header.split(" | ")[-1] if " | " in raw_header else raw_header
                category_part = category_part.split("(")[0].strip()

                value, missing_reason = clean_numeric(row[col_idx])
                measure_type = "cases"
                unit = "count"

                obs = Observation(
                    observation_id=stable_id("obs", source_id, str(year), current_state or "", region_name, raw_header),
                    year=year,
                    state_id=stable_id("state", current_state or ""),
                    state_name=current_state or "",
                    geography_id=geography_id,
                    region_name=region_name,
                    original_region_name=original_region_name,
                    region_type=region_type,
                    geography_version=geography_version,
                    category_id=stable_id("cat", category_part),
                    original_category=category_part,
                    measure_type=measure_type,
                    unit=unit,
                    reported_value=value,
                    missing_reason=missing_reason,
                    law_framework="IPC",
                    source_id=source_id,
                    source_row_reference=f"row_{row_idx}",
                    quality_status="valid" if missing_reason is None else "warning",
                    comparison_status="eligible" if not is_total else "aggregate_only",
                )
                observations.append(obs)

    return observations


def write_observations(observations: list[Observation], out_path: Path) -> None:
    """Write observations to a CSV file in long format."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "observation_id", "year", "state_id", "state_name", "geography_id",
        "region_name", "original_region_name", "region_type", "geography_version",
        "category_id", "original_category", "measure_type", "unit",
        "reported_value", "missing_reason", "law_framework", "source_id",
        "source_row_reference", "quality_status", "comparison_status",
    ]
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for obs in observations:
            writer.writerow(asdict(obs))


def build_row_accounting(
    csv_path: Path,
    observations: list[Observation],
) -> dict:
    """Build stepwise row-accounting summary."""
    raw_rows = 0
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if row and any(c.strip() for c in row):
                raw_rows += 1

    total_observations = len(observations)
    valid = sum(1 for o in observations if o.quality_status == "valid")
    warnings = sum(1 for o in observations if o.quality_status == "warning")
    aggregates = sum(1 for o in observations if o.comparison_status == "aggregate_only")
    eligible = total_observations - aggregates

    return {
        "source_rows": raw_rows,
        "canonical_observations": total_observations,
        "valid": valid,
        "warnings": warnings,
        "eligible_for_comparison": eligible,
        "aggregate_rows": aggregates,
        "regions": len({o.region_name for o in observations if o.region_name}),
        "categories": len({o.category_id for o in observations}),
    }
