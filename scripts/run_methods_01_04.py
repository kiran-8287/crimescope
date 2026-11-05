"""Run methods 01-04 from the same checksum-verified manifest input as Phase C."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "analysis" / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from crimescope_analysis.cleaning.canonical import (  # noqa: E402
    apply_mappings, build_row_accounting, detect_duplicates, load_category_mapping,
    load_geography_mapping, parse_table, validate_totals, write_observations,
)
from crimescope_analysis.methods.descriptive import run_descriptive_statistics  # noqa: E402
from crimescope_analysis.methods.bivariate import run_bivariate_analysis  # noqa: E402
from crimescope_analysis.features.engineering import run_feature_engineering  # noqa: E402
from source_inputs import dataset_source_manifest, load_source_inputs  # noqa: E402


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_method_01(output_dir: Path, include_2020: bool = True) -> dict:
    sources = load_source_inputs(ROOT, include_2020=include_2020)
    geo_mapping = load_geography_mapping(ROOT / "data/mappings/geography_crosswalk.csv")
    cat_mapping = load_category_mapping(ROOT / "data/mappings/category_crosswalk.csv")
    all_obs, accounting = [], {}
    for src in sources:
        obs = parse_table(src["path"], src["year"], src["source_id"],
                          geography_version=src.get("geography_version"),
                          state_name_hint=src.get("state_name"), header_template=src.get("header_template"))
        obs = apply_mappings(obs, geo_mapping, cat_mapping)
        accounting[src["source_id"]] = build_row_accounting(src["path"], obs)
        all_obs.extend(obs)
    all_obs = validate_totals(detect_duplicates(all_obs))
    output_dir.mkdir(parents=True, exist_ok=True)
    canon_csv = output_dir / "crime_observations_canonical.csv"
    write_observations(all_obs, canon_csv)
    return {"method": "01_data_processing", "total_observations": len(all_obs),
            "output_csv": str(canon_csv), "output_sha256": sha256(canon_csv),
            "source_files": len(sources), "accounting": accounting,
            "source_selection": dataset_source_manifest(sources),
            "exclusions": {"duplicates": sum(o.quality_status == "duplicate" for o in all_obs),
                           "aggregate_rows": sum(o.comparison_status == "aggregate_only" for o in all_obs),
                           "2020_scope": "partial Andhra Pradesh only" if include_2020 else "excluded"}}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="analysis/output/expanded_methods_01_04")
    parser.add_argument("--without-2020", action="store_true")
    args = parser.parse_args(argv)
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    m01 = run_method_01(output_dir, include_2020=not args.without_2020)
    canon_csv = Path(m01["output_csv"])
    m02 = {"method": "02_descriptive_statistics", **run_descriptive_statistics(canon_csv, output_dir / "method_02_descriptive")}
    m03 = {"method": "03_bivariate_analysis", **run_bivariate_analysis(canon_csv, output_dir / "method_03_bivariate")}
    m04 = {"method": "04_feature_engineering", **run_feature_engineering(canon_csv, output_dir / "method_04_feature_engineering.csv")}
    manifest = {"methods_run": ["01", "02", "03", "04"], "results": [m01, m02, m03, m04],
                "input_dataset_sha256": m01["output_sha256"], "input_selection": m01["source_selection"]}
    (output_dir / "methods_01_04_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"output_dir": str(output_dir), "observations": m01["total_observations"],
                      "source_files": m01["source_files"], "feature_rows": m04["region_year_rows"],
                      "feature_input": m04["output_csv"]}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
