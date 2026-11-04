"""Run methods 08-09: anomaly detection and association rules."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "analysis" / "src"))

from crimescope_analysis.methods.anomaly import run_anomaly_detection  # noqa: E402
from crimescope_analysis.methods.association import run_association_rules  # noqa: E402

FEATURE_CSV = Path("analysis/output/method_04_feature_engineering.csv")
OUTPUT_DIR = Path("analysis/output")
YEARS = [2020, 2021, 2022, 2023, 2024]


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Method 08: Anomaly detection
    anomaly_dir = OUTPUT_DIR / "method_08_anomaly"
    m08 = run_anomaly_detection(FEATURE_CSV, anomaly_dir, YEARS)
    print(json.dumps(m08, indent=2))

    # Method 09: Association rules
    assoc_dir = OUTPUT_DIR / "method_09_association"
    m09 = run_association_rules(FEATURE_CSV, assoc_dir, YEARS)
    print(json.dumps(m09, indent=2))

    manifest = {
        "methods_run": ["08", "09"],
        "results": [m08, m09],
    }
    with (OUTPUT_DIR / "methods_08_09_manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\nPhase F methods 08-09 complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
