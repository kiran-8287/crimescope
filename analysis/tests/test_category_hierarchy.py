import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "analysis" / "src"))
spec = importlib.util.spec_from_file_location("build_category_hierarchy", ROOT / "scripts" / "build_category_hierarchy.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CategoryHierarchyTests(unittest.TestCase):
    def test_source_labels_and_roles_are_retained(self):
        catalog = {entry["id"]: entry for entry in module.build()["categories"]}
        self.assertEqual(catalog["90d17a9d8cd3277ac20cf68d"]["label"], "Murder")
        self.assertEqual(catalog["844556c1c1720c789e935afd"]["label"], "Culpable Homicide not amounting to Murder")
        self.assertIn("official_total", catalog[next(i for i, x in catalog.items() if x["label"] == "Total Cognizable IPC/BNS crimes")]["rolesByYear"]["2024"])

    def test_2024_feature_set_excludes_parent_totals(self):
        config = module.build()
        catalog = config["categories"]
        selected = [item for item in catalog if "2024" in item["rolesByYear"] and any(role in config["pcaFeatureRoles"] for role in item["rolesByYear"]["2024"])]
        self.assertEqual(len(selected), 131)
        self.assertTrue(all("parent_total" not in item["rolesByYear"]["2024"] and "official_total" not in item["rolesByYear"]["2024"] for item in selected))

    def test_overlapping_source_hierarchy_does_not_enable_composition_shares(self):
        config = module.build()
        self.assertFalse(config["compositionSharesAvailable"])
        categories = {entry["id"]: entry for entry in config["categories"]}
        # The IPC category above is not present in the 2024 BNS source. Its
        # 2024 equivalent is a separate category ID and is correctly marked
        # as a parent total.
        self.assertIn("parent_total", categories["13ae11811ad045471a7c6260"]["rolesByYear"]["2024"])
        self.assertEqual(categories["844556c1c1720c789e935afd"]["label"], "Culpable Homicide not amounting to Murder")


if __name__ == "__main__":
    unittest.main()
