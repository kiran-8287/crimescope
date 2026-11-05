"""Build canonical observations from explicit 2020 AP plus verified 2021-24 fragments."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "analysis" / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from crimescope_analysis.cleaning.canonical import (  # noqa: E402
    apply_mappings, build_quality_report, build_row_accounting, detect_duplicates,
    load_category_mapping, load_geography_mapping, parse_table, validate_totals,
    write_observations,
)
from source_inputs import dataset_source_manifest, load_source_inputs  # noqa: E402

DEFAULT_OUTPUT = ROOT / "data/processed"
GEO_MAPPING = ROOT / "data/mappings/geography_crosswalk.csv"
CAT_MAPPING = ROOT / "data/mappings/category_crosswalk.csv"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def coverage_rows(observations: list, sources: list[dict]) -> tuple[list[dict], dict, list[dict]]:
    by_state: dict[tuple[int, str], list] = defaultdict(list)
    for obs in observations:
        by_state[(obs.year, obs.state_name)].append(obs)
    fragment_counts = Counter((src["year"], src.get("state_name") or "Unknown") for src in sources)
    coverage: list[dict] = []
    reconciliation: list[dict] = []
    for (year, state), group in sorted(by_state.items()):
        units = {}
        for kind in ("administrative_district", "city_police", "railway", "other_police_unit", "aggregate", "unknown"):
            units[kind] = len({o.geography_id for o in group if o.region_type == kind})
        official = [o for o in group if o.original_category in {"Total Cognizable IPC crimes", "Total Cognizable IPC/BNS crimes"}]
        aggregate_total = next((o.reported_value for o in official if o.region_type == "aggregate" and o.original_region_name.casefold() == "total districts"), None)
        district_values = [o.reported_value for o in official if o.region_type == "administrative_district" and o.reported_value is not None]
        district_sum = sum(district_values) if district_values else None
        reporting_values = [o.reported_value for o in official if o.comparison_status == "eligible" and o.reported_value is not None]
        reporting_sum = sum(reporting_values) if reporting_values else None
        difference = aggregate_total - reporting_sum if aggregate_total is not None and reporting_sum is not None else None
        reconciliation.append({"year": year, "state_ut": state, "category": next((o.original_category for o in official), ""),
                               "aggregate_value": aggregate_total, "district_official_total_sum": district_sum,
                               "all_reporting_unit_official_total_sum": reporting_sum,
                               "difference": difference, "status": "match" if difference == 0 else "difference" if difference is not None else "unavailable"})
        coverage.append({
            "year": year, "state_ut": state, "coverage_scope": "partial_2020_andhra_pradesh" if year == 2020 else "indexed_state_ut_fragment",
            "fragments": fragment_counts[(year, state)],
            "administrative_districts": units["administrative_district"], "city_police_units": units["city_police"],
            "railway_units": units["railway"], "other_police_units": units["other_police_unit"], "aggregate_rows": units["aggregate"],
            "retained_observations": sum(o.comparison_status == "eligible" and o.quality_status not in {"duplicate", "quarantined"} for o in group),
            "all_observations": len(group), "valid": sum(o.quality_status == "valid" for o in group),
            "warnings_or_missing": sum(o.quality_status == "warning" for o in group),
            "duplicates_excluded": sum(o.quality_status == "duplicate" for o in group),
            "aggregate_observations_excluded_from_district_sums": sum(o.comparison_status == "aggregate_only" for o in group),
            "explicit_zero_values": sum(o.reported_value == 0 for o in group),
            "missing_or_unparseable_values": sum(o.reported_value is None for o in group),
            "official_total_aggregate_value": aggregate_total,
            "sum_of_district_official_totals": district_sum,
            "sum_of_all_reporting_unit_official_totals": reporting_sum,
            "official_total_reconciliation_difference": difference,
        })
    names_to_states: dict[str, set[str]] = defaultdict(set)
    ids_for_name_state_year: dict[tuple[int, str, str], set[str]] = defaultdict(set)
    for obs in observations:
        if obs.region_type == "administrative_district":
            names_to_states[obs.region_name].add(obs.state_name)
            ids_for_name_state_year[(obs.year, obs.region_name, obs.state_name)].add(obs.geography_id)
    repeated = {name: sorted(states) for name, states in names_to_states.items() if len(states) > 1}
    repeated_validation = {
        "district_names_repeated_across_states": repeated,
        "same_year_name_state_pairs_with_multiple_geography_ids": {
            f"{year}|{name}|{state}": sorted(ids) for (year, name, state), ids in ids_for_name_state_year.items() if len(ids) > 1
        },
        "state_included_in_geography_id": True,
    }
    return coverage, repeated_validation, reconciliation


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT), help="Build output directory; use a staging directory before publishing")
    parser.add_argument("--without-2020", action="store_true", help="Build only manifest-backed 2021-2024 fragments")
    args = parser.parse_args(argv)
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir
    row_accounting_dir = output_dir / "row_accounting"
    row_accounting_dir.mkdir(parents=True, exist_ok=True)
    sources = load_source_inputs(ROOT, include_2020=not args.without_2020)
    geo_mapping = load_geography_mapping(GEO_MAPPING)
    cat_mapping = load_category_mapping(CAT_MAPPING)

    all_observations: list = []
    all_accounting: dict[str, dict] = {}
    for src in sources:
        print(f"Processing {src['path']} (year={src['year']}, state/UT={src.get('state_name')})")
        observations = parse_table(src["path"], src["year"], src["source_id"],
                                   geography_version=src.get("geography_version"),
                                   state_name_hint=src.get("state_name"),
                                   header_template=src.get("header_template"))
        observations = apply_mappings(observations, geo_mapping, cat_mapping)
        accounting = build_row_accounting(src["path"], observations)
        accounting.update({"year": src["year"], "state_ut": src.get("state_name"), "table_id": src["table_id"],
                          "partial_source": bool(src.get("partial")), "input_sha256": sha256(src["path"])})
        all_accounting[src["source_id"]] = accounting
        all_observations.extend(observations)

    all_observations = detect_duplicates(all_observations)
    all_observations = validate_totals(all_observations)
    output_dir.mkdir(parents=True, exist_ok=True)
    data_path = output_dir / "crime_observations_multi_year.csv"
    write_observations(all_observations, data_path)
    quarantined = [o for o in all_observations if o.quarantine_reason is not None]
    write_observations(quarantined, output_dir / "quarantined_observations.csv")
    report = build_quality_report(
        all_accounting, len(all_observations), len(quarantined),
        sum(o.quality_status == "duplicate" for o in all_observations),
        sum(o.quality_status == "totals_mismatch" for o in all_observations),
    )
    coverage, name_validation, reconciliations = coverage_rows(all_observations, sources)
    report["coverage_by_year_state"] = coverage
    report["cross_state_name_validation"] = name_validation
    report["official_total_reconciliation"] = reconciliations
    report["source_selection"] = dataset_source_manifest(sources)
    report["summary"].update({"data_sha256": sha256(data_path), "year_count": len({o.year for o in all_observations}),
                              "states_or_uts": len({o.state_name for o in all_observations}),
                              "region_type_counts": {kind: len({o.geography_id for o in all_observations if o.region_type == kind})
                                                     for kind in ("administrative_district", "city_police", "railway", "other_police_unit", "aggregate")}})
    if not args.without_2020:
        prior_path = ROOT / "data/processed/quality_report.json"
        if prior_path.exists():
            try:
                prior_investigation = json.loads(prior_path.read_text(encoding="utf-8")).get("source_cell_completeness_investigation")
                if prior_investigation:
                    report["source_cell_completeness_investigation"] = prior_investigation
            except (OSError, json.JSONDecodeError):
                pass
    (output_dir / "quality_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with (output_dir / "coverage_by_year_state.csv").open("w", encoding="utf-8", newline="") as handle:
        fields = list(coverage[0]) if coverage else []
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(coverage)
    with (output_dir / "reconciliation_by_year_state.csv").open("w", encoding="utf-8", newline="") as handle:
        fields = list(reconciliations[0]) if reconciliations else []
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(reconciliations)
    (output_dir / "source_selection_manifest.json").write_text(json.dumps(report["source_selection"], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"output_dir": str(output_dir), "observations": len(all_observations), "source_files": len(sources),
                      "coverage_rows": len(coverage), "duplicate_observations": report["summary"]["total_duplicates"],
                      "official_total_mismatches": report["summary"]["total_totals_mismatch"],
                      "dataset_sha256": report["summary"]["data_sha256"]}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
