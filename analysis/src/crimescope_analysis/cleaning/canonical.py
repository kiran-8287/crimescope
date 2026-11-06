"""Multi-year canonical long-format row emitter with quarantine and mapping support."""

from __future__ import annotations

import csv
import hashlib
import re
from dataclasses import asdict, dataclass, field
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
    quarantine_reason: Optional[str] = None
    mapped_geography_id: Optional[str] = None
    mapped_category_id: Optional[str] = None


STATE_PREFIX = re.compile(r"^State:\s*(.+?)\s*$")
TOTAL_TOKENS = {"total districts", "total", "total districts ", "total districts\t"}

EXPLICIT_ADMINISTRATIVE_DISTRICTS = {
    "bengaluru rural",
    "bangalore rural",
    "kanpur dehat",
}

REGION_ACRONYMS = {
    "railway": [
        r"\bgrp\b",
        r"\bsrp\b",
        r"\brly\b",
        r"\bw\.?\s*rly\b",
        r"\brailway\b",
        r"\brailways\b",
        r"\bk\.?\s*railways?\b",
    ],
    "city_police": [r"\bcommr\b", r"\bcommissionarate\b", r"\bdcp\b", r"\bcp\b"],
    "other_police_unit": [
        r"\brural\b",
        r"\bstf\b",
        r"\beow\b",
        r"\brpo\b",
        r"\bsou\b",
        r"\bssb\b",
        r"\bk\.?g\.?f\.?\b",
        r"\bcid\b",
        r"\bcrime branch\b",
        r"\bcyber\b",
        r"\bspecial task force\b",
        r"\beconomic offences\b",
        r"\banti narcotic\b",
        r"\bcrime wing\b",
        r"\bcrime and eou\b",
        r"\bigi airport\b",
        r"\bairport\b",
        r"\bspl cell\b",
        r"\bvigilance\b",
        r"\bbureau of investigation\b",
        r"\banti terrorist squad\b",
        r"\bpolice district\b",
        r"\bpolice dist\b",
        r"\bpolice\b",
        r"\bother units\b",
        r"\bcrime\b",
        r"\bnarcotic\b",
        r"\bnarcotics\b",
        r"\ball districts\b",
        r"\bsog\b",
        r"\bats\b",
        r"\bkanpur outer\b",
        r"\blucknow grameen\b",
        r"\bvasanasi dehat\b",
        r"\bvaranasi dehat\b",
    ],
}


def parse_state_line(raw: str) -> tuple[str, str]:
    m = STATE_PREFIX.match(raw.strip())
    if m:
        return m.group(1).strip(), "state"
    return raw.strip(), "unknown"


def classify_region(name: str) -> str:
    lower = name.lower().strip()
    if lower in TOTAL_TOKENS or lower == "":
        return "aggregate"
    if lower in EXPLICIT_ADMINISTRATIVE_DISTRICTS:
        return "administrative_district"
    if "railway" in lower:
        return "railway"
    for pat in REGION_ACRONYMS["railway"]:
        if re.search(pat, lower):
            return "railway"
    if any(token in lower for token in ("city", "urban", "commissionerate", "metro")):
        return "city_police"
    for pat in REGION_ACRONYMS["city_police"]:
        if re.search(pat, lower):
            return "city_police"
    for pat in REGION_ACRONYMS["other_police_unit"]:
        if re.search(pat, lower):
            return "other_police_unit"
    return "administrative_district"


def stable_id(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:24]


def category_display_labels(raw_headers: list[str]) -> list[str]:
    """Return readable leaf labels, disambiguating repeated leaves in a source schema."""
    leaves = [header.split(" | ")[-1] if " | " in header else header for header in raw_headers]
    bases = [re.sub(r"\s*\([^)]*\)", "", leaf).strip() for leaf in leaves]
    counts: dict[str, int] = {}
    for base in bases:
        counts[base] = counts.get(base, 0) + 1
    labels: list[str] = []
    for header, leaf, base in zip(raw_headers, leaves, bases):
        if counts[base] <= 1:
            labels.append(base)
            continue
        qualifiers = [value.strip() for value in re.findall(r"\(([^()]*)\)", leaf) if not value.strip().casefold().startswith("col.")]
        qualifier = qualifiers[0] if qualifiers else ""
        if not qualifier:
            sections = header.split(" | ")[:-1]
            qualifier = sections[-1] if sections else "source column"
        labels.append(f"{base} ({qualifier})")
    if len(set(labels)) != len(labels):
        raise ValueError("A year source schema contains indistinguishable repeated category headers")
    return labels


def clean_numeric(token: str) -> tuple[Optional[int], Optional[str]]:
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
    geography_version: str | None = None,
    state_name_hint: str | None = None,
    header_template: list[str] | None = None,
) -> list[Observation]:
    """Parse a source table or a state fragment from tables_index.csv.

    Indexed fragments may have generic ``col_N`` headers and no repeated state
    row. Their state comes from the download manifest and their category headers
    from the matching year's t1 header template.
    """
    observations: list[Observation] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)

    index_fragment = len(header) >= 4 and header[0].strip().casefold() == "section" and header[1].strip().casefold() == "sl_no"
    if header_template is not None:
        if len(header_template) != len(header):
            raise ValueError(f"Header template width differs from source fragment: {csv_path}")
        if index_fragment:
            header = header_template
    col_count = len(header)
    display_categories = category_display_labels(header[3:])
    geography_version = geography_version or f"ncrb-{year}"
    current_state: Optional[str] = None

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        next(reader)
        for row_idx, row in enumerate(reader, start=2):
            if not row or all(c.strip() == "" for c in row):
                continue

            state_cell = row[0].strip() if row else ""
            geography_index = 2 if index_fragment else 2
            region_name = row[geography_index].strip() if len(row) > geography_index else ""

            if index_fragment:
                if state_cell.lower().startswith("state:"):
                    current_state = parse_state_line(state_cell)[0]
                # t1 contains a numbered sub-header at row 2; other state
                # fragments contain district rows with an empty section cell.
                if not region_name or (state_cell == "" and region_name.isdigit()):
                    continue
            elif not state_cell:
                continue

            state_name, _ = parse_state_line(state_cell)
            if state_cell.lower().startswith("state:"):
                current_state = state_name
            if current_state is None:
                current_state = state_name_hint or state_name

            sl_no = row[1].strip() if len(row) > 1 else ""
            original_region_name = region_name
            region_type = classify_region(region_name)
            is_total = region_type == "aggregate"
            geography_id = stable_id("geo", current_state or "", region_name, str(year))

            for col_idx in range(3, col_count):
                if col_idx >= len(row):
                    # A missing trailing CSV cell is not converted to a zero or
                    # a synthetic observation.
                    continue
                raw_header = header[col_idx] if col_idx < len(header) else f"col_{col_idx}"
                category_part = display_categories[col_idx - 3]
                value, missing_reason = clean_numeric(row[col_idx])
                quarantine_reason: Optional[str] = None
                if is_total:
                    quarantine_reason = "aggregate_row_excluded_from_comparison"
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
                    measure_type="cases",
                    unit="count",
                    reported_value=value,
                    missing_reason=missing_reason,
                    law_framework="IPC" if year < 2024 else "BNS",
                    source_id=source_id,
                    source_row_reference=f"row_{row_idx}",
                    quality_status="valid" if missing_reason is None else "warning",
                    comparison_status="eligible" if not is_total else "aggregate_only",
                    quarantine_reason=quarantine_reason,
                )
                observations.append(obs)
    return observations

def write_observations(observations: list[Observation], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "observation_id", "year", "state_id", "state_name", "geography_id",
        "region_name", "original_region_name", "region_type", "geography_version",
        "category_id", "original_category", "measure_type", "unit",
        "reported_value", "missing_reason", "law_framework", "source_id",
        "source_row_reference", "quality_status", "comparison_status",
        "quarantine_reason", "mapped_geography_id", "mapped_category_id",
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
    quarantined = sum(1 for o in observations if o.quarantine_reason is not None)
    aggregates = sum(1 for o in observations if o.comparison_status == "aggregate_only")
    eligible = total_observations - aggregates

    return {
        "source_rows": raw_rows,
        "canonical_observations": total_observations,
        "valid": valid,
        "warnings": warnings,
        "quarantined": quarantined,
        "eligible_for_comparison": eligible,
        "aggregate_rows": aggregates,
        "regions": len({o.region_name for o in observations if o.region_name}),
        "categories": len({o.category_id for o in observations}),
    }


def load_geography_mapping(mapping_path: Path) -> dict[str, str]:
    """Load geography crosswalk: original_name -> canonical_name."""
    mapping: dict[str, str] = {}
    if not mapping_path.exists():
        return mapping
    with mapping_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            original = row.get("original_name", "").strip()
            canonical = row.get("canonical_name", "").strip()
            if original and canonical:
                mapping[original] = canonical
    return mapping


def load_category_mapping(mapping_path: Path) -> dict[str, str]:
    """Load category crosswalk: original_name -> canonical_name."""
    mapping: dict[str, str] = {}
    if not mapping_path.exists():
        return mapping
    with mapping_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            original = row.get("original_name", "").strip()
            canonical = row.get("canonical_name", "").strip()
            if original and canonical:
                mapping[original] = canonical
    return mapping


def apply_mappings(
    observations: list[Observation],
    geo_mapping: dict[str, str],
    cat_mapping: dict[str, str],
) -> list[Observation]:
    """Apply geography and category mappings; update mapped IDs."""
    result: list[Observation] = []
    for obs in observations:
        mapped_geo = geo_mapping.get(obs.original_region_name)
        mapped_cat = cat_mapping.get(obs.original_category)
        obs.mapped_geography_id = stable_id("mapped_geo", mapped_geo or obs.original_region_name, str(obs.year)) if mapped_geo else None
        obs.mapped_category_id = stable_id("mapped_cat", mapped_cat or obs.original_category) if mapped_cat else None
        result.append(obs)
    return result


def detect_duplicates(observations: list[Observation]) -> list[Observation]:
    """Mark duplicate observations (same year+state+region+category across sources)."""
    seen: dict[tuple, int] = {}
    result: list[Observation] = []
    for obs in observations:
        key = (obs.year, obs.state_name, obs.original_region_name, obs.original_category)
        if key in seen:
            obs.quality_status = "duplicate"
            obs.quarantine_reason = f"duplicate_of_row_{seen[key]}"
        else:
            seen[key] = int(obs.source_row_reference.split("_")[1]) if obs.source_row_reference.startswith("row_") else 0
        result.append(obs)
    return result


def validate_totals(
    observations: list[Observation],
    total_category: str = "Total Cognizable IPC crimes",
    total_category_bns: str = "Total Cognizable IPC/BNS crimes",
) -> list[Observation]:
    """Reconcile official aggregate totals against district official totals.

    Crime category columns overlap hierarchically, so summing every category to
    check an official grand total is not a valid reconciliation.
    """
    total_labels = {total_category, total_category_bns}
    reporting_unit_totals: dict[tuple[int, str], list[int]] = {}
    for obs in observations:
        if obs.original_category not in total_labels or obs.reported_value is None:
            continue
        key = (obs.year, obs.state_name)
        if obs.comparison_status == "eligible":
            reporting_unit_totals.setdefault(key, []).append(obs.reported_value)
    for obs in observations:
        if obs.original_category not in total_labels or obs.region_type != "aggregate" or obs.reported_value is None:
            continue
        values = reporting_unit_totals.get((obs.year, obs.state_name), [])
        if values and sum(values) != obs.reported_value:
            obs.quality_status = "totals_mismatch"
            obs.quarantine_reason = f"official aggregate={obs.reported_value}, reporting-unit official-total sum={sum(values)}"
    return observations


def build_quality_report(
    all_accounting: dict[str, dict],
    total_observations: int,
    total_quarantined: int,
    total_duplicates: int,
    total_totals_mismatch: int,
) -> dict:
    return {
        "per_source": all_accounting,
        "summary": {
            "total_sources": len(all_accounting),
            "total_source_rows": sum(a["source_rows"] for a in all_accounting.values()),
            "total_canonical_observations": total_observations,
            "total_quarantined": total_quarantined,
            "total_duplicates": total_duplicates,
            "total_totals_mismatch": total_totals_mismatch,
            "eligible_for_comparison": sum(a["eligible_for_comparison"] for a in all_accounting.values()),
        },
    }
