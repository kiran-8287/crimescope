"""Run methods 05-07: PCA, K-means, Hierarchical Clustering."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "analysis" / "src"))

from crimescope_analysis.features.engineering import load_observations  # noqa: E402
from crimescope_analysis.methods.pca import run_pca  # noqa: E402
from crimescope_analysis.methods.kmeans import run_kmeans  # noqa: E402
from crimescope_analysis.methods.hierarchical import run_hierarchical  # noqa: E402

FEATURE_CSV = Path("analysis/output/method_04_feature_engineering.csv")
OUTPUT_DIR = Path("analysis/output")
YEARS = [2021, 2022, 2023, 2024]
K_VALUES = [3, 4, 5]


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = load_observations(FEATURE_CSV)

    # Method 05: PCA
    pca_dir = OUTPUT_DIR / "method_05_pca"
    m05 = run_pca(FEATURE_CSV, pca_dir, YEARS)
    print(json.dumps(m05, indent=2))

    # Method 06: K-means
    kmeans_dir = OUTPUT_DIR / "method_06_kmeans"
    m06 = run_kmeans(FEATURE_CSV, kmeans_dir, YEARS, K_VALUES)
    print(json.dumps(m06, indent=2))

    # Method 07: Hierarchical clustering
    hier_dir = OUTPUT_DIR / "method_07_hierarchical"
    m07 = run_hierarchical(FEATURE_CSV, hier_dir, YEARS, max_clusters=3)
    print(json.dumps(m07, indent=2))

    manifest = {
        "methods_run": ["05", "06", "07"],
        "results": [m05, m06, m07],
    }
    with (OUTPUT_DIR / "methods_05_07_manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\nPhase E methods 05-07 complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
