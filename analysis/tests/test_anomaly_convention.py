"""Regression test for the anomaly z-score convention.

The saved 2024 cross-sectional anomaly flags use a *sample* standard deviation
(ddof=1) for the per-category cohort. The dashboard's "Mathematical Note" once
displayed a *population* standard deviation instead, which disagreed with the
saved numbers. This test pins the convention in two independent ways:

1. unit-level: the module's private ``_std`` must use ddof=1, and a single
   positive case among N-1 zeros must yield z = (N-1)/sqrt(N);
2. artifact-level: the rare flag in the saved ``anomalies_2024.json`` is
   reproduced from the raw cohort values in the active run's ``feature_input.csv``.

Artifact checks skip (rather than fail) when generated outputs are absent, since
``analysis/output`` is gitignored.
"""

import csv
import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "analysis" / "src"))

from crimescope_analysis.methods import anomaly  # noqa: E402


class AnomalyConventionTests(unittest.TestCase):
    def test_module_uses_sample_std(self):
        vals = [1.0, 2.0, 3.0, 4.0, 5.0]
        mean = sum(vals) / len(vals)
        sample = math.sqrt(sum((v - mean) ** 2 for v in vals) / (len(vals) - 1))
        population = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))
        self.assertAlmostEqual(anomaly._std(vals), sample, places=12)
        self.assertNotAlmostEqual(anomaly._std(vals), population, places=12)

    def test_single_positive_case_identity(self):
        # One case among N-1 zeros reduces to z = (N-1)/sqrt(N) under ddof=1.
        n = 774
        vals = [0.0] * (n - 1) + [1.0]
        z = (1.0 - anomaly._mean(vals)) / anomaly._std(vals)
        self.assertAlmostEqual(z, (n - 1) / math.sqrt(n), places=9)
        self.assertAlmostEqual(z, 27.7849, places=4)

    def test_saved_rare_flag_reproduces_from_cohort(self):
        run_pointer = ROOT / "analysis/output/runs/current.json"
        if not run_pointer.exists():
            self.skipTest("no active analysis run pointer")
        manifest_rel = json.loads(run_pointer.read_text(encoding="utf-8"))["manifest"]
        manifest_path = ROOT / manifest_rel
        run_dir = manifest_path.parent
        anomaly_path = run_dir / "anomalies/anomalies_2024.json"
        feature_path = run_dir / "feature_input.csv"
        if not anomaly_path.exists() or not feature_path.exists():
            self.skipTest("saved anomaly artifacts not present")

        flags = json.loads(anomaly_path.read_text(encoding="utf-8"))["cross_sectional"]
        rare = max(flags, key=lambda a: abs(a["z_score"]))

        # Rebuild the category cohort from the raw feature input, independent of
        # the saved mean/std, and recompute the sample-std z.
        values = []
        with feature_path.open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if row["category"] == rare["category"]:
                    values.append(float(row["total"] or 0))
        self.assertGreater(len(values), 2)
        mean = sum(values) / len(values)
        std = anomaly._std(values)
        reproduced = (float(rare["value"]) - mean) / std
        self.assertAlmostEqual(reproduced, rare["z_score"], places=3)


if __name__ == "__main__":
    unittest.main()
