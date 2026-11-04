"""Run methods 01-04: data processing, descriptive statistics, bivariate analysis, feature engineering."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "analysis" / "src"))

from crimescope_analysis.cleaning.canonical import (  # noqa: E402
    parse_table,
    write_observations,
    build_row_accounting,
)
from crimescope_analysis.methods.descriptive import run_descriptive_statistics  # noqa: E402
from crimescope_analysis.methods.bivariate import run_bivariate_analysis  # noqa: E402
from crimescope_analysis.features.engineering import run_feature_engineering  # noqa: E402


SOURCE_TABLES = [
    {"year": 2020, "source_id": "cii_2020_1_districtwise-ipc-crimes_t1", "path": "data/raw/2020/1_districtwise-ipc-crimes-2020_t1.csv"},
    {"year": 2021, "source_id": "cii_2021_1_districtwise-ipc-crimes_t1", "path": "data/raw/2021/1_16730065601districtwiseipccrimes2021_t1.csv"},
    {"year": 2022, "source_id": "cii_2022_1_districtwise-ipc-crimes_t1", "path": "data/raw/2022/1_17016833111districtwiseipccrimes2022_t1.csv"},
    {"year": 2023, "source_id": "cii_2023_1_districtwise-ipc-crimes_t1", "path": "data/raw/2023/1_1districtwiseipccrimes20231_t1.csv"},
    {"year": 2024, "source_id": "cii_2024_1_districtwise-ipc-crimes_t1", "path": "data/raw/2024/1_1districtwiseipccrimes2024_t1.csv"},
]

METHODS_DIR = Path("methods")
OUTPUT_DIR = Path("analysis/output")


def run_method_01() -> dict:
    """Data processing: build canonical observations from all source tables."""
    all_obs = []
    accounting = {}
    for src in SOURCE_TABLES:
        csv_path = Path(src["path"])
        obs = parse_table(csv_path, src["year"], src["source_id"])
        # Skip sub-header rows already handled in parse_table
        all_obs.extend(obs)
        accounting[src["source_id"]] = build_row_accounting(csv_path, obs)

    canon_csv = OUTPUT_DIR / "crime_observations_canonical.csv"
    canon_csv.parent.mkdir(parents=True, exist_ok=True)
    write_observations(all_obs, canon_csv)

    return {
        "method": "01_data_processing",
        "total_observations": len(all_obs),
        "output_csv": str(canon_csv),
        "accounting": accounting,
    }


def run_method_02(input_csv: Path) -> dict:
    """Descriptive statistics."""
    out_dir = OUTPUT_DIR / "method_02_descriptive"
    return {
        "method": "02_descriptive_statistics",
        **run_descriptive_statistics(input_csv, out_dir),
    }


def run_method_03(input_csv: Path) -> dict:
    """Bivariate analysis."""
    out_dir = OUTPUT_DIR / "method_03_bivariate"
    return {
        "method": "03_bivariate_analysis",
        **run_bivariate_analysis(input_csv, out_dir),
    }


def run_method_04(input_csv: Path) -> dict:
    """Feature engineering."""
    out_csv = OUTPUT_DIR / "method_04_feature_engineering.csv"
    return {
        "method": "04_feature_engineering",
        **run_feature_engineering(input_csv, out_csv),
    }


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    m01 = run_method_01()
    print(json.dumps(m01, indent=2))

    canon_csv = Path(m01["output_csv"])
    m02 = run_method_02(canon_csv)
    print(json.dumps(m02, indent=2))

    m03 = run_method_03(canon_csv)
    print(json.dumps(m03, indent=2))

    m04 = run_method_04(canon_csv)
    print(json.dumps(m04, indent=2))

    # Write combined manifest
    manifest = {
        "methods_run": ["01", "02", "03", "04"],
        "results": [m01, m02, m03, m04],
    }
    with (OUTPUT_DIR / "methods_01_04_manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\nPhase D methods 01-04 complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
