import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from crimescope_analysis.methods.pca import pca


class PCARegressionTests(unittest.TestCase):
    def test_variance_ratio_matches_full_svd_denominator(self):
        X = np.asarray([[1, 2, 8], [2, 5, 3], [4, 1, 7], [8, 4, 2], [5, 9, 1]], dtype=float)
        regions = [f"r{i}" for i in range(len(X))]
        categories = ["a", "b", "c"]
        matrix = {region: {category: float(X[i, j]) for j, category in enumerate(categories)} for i, region in enumerate(regions)}
        result = pca({"year": 1, "regions": regions, "categories": categories, "matrix": matrix}, n_components=2)
        singular = np.linalg.svd(X - X.mean(axis=0), full_matrices=False)[1]
        total_variance = float(np.sum(singular ** 2) / (len(X) - 1))
        expected = (singular[:2] ** 2 / (len(X) - 1)) / total_variance
        np.testing.assert_allclose(result["explained_variance_ratio"], expected, rtol=1e-10, atol=1e-12)
        self.assertAlmostEqual(result["total_feature_variance"], total_variance, places=10)
        self.assertLess(sum(result["explained_variance_ratio"]), 1.0)


if __name__ == "__main__":
    unittest.main()
