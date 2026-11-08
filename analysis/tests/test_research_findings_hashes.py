"""Focused tests for the research-findings artifact hash verification.

These tests use only temporary fixtures: they never read or modify the real
release, run, or artifact files under the repository.
"""

import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "research_findings.py"


def load_module():
    spec = importlib.util.spec_from_file_location("research_findings", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ArtifactHashVerificationTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()
        self.rel = "pca/pca_2024.json"

    def _write(self, tmp: Path, payload: bytes) -> str:
        path = tmp / self.rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        return hashlib.sha256(payload).hexdigest()

    def test_valid_artifact_passes(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            run_dir = Path(d)
            recorded = self._write(run_dir, b'{"ok": true}')
            ok, detail = self.mod.verify_artifact_hash(
                {"artifacts": {self.rel: recorded}}, run_dir, self.rel
            )
            self.assertTrue(ok, detail)

    def test_modified_artifact_is_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            run_dir = Path(d)
            recorded = self._write(run_dir, b'{"ok": true}')
            # Modify the file after the hash was recorded; the check must fail.
            (run_dir / self.rel).write_bytes(b'{"ok": false}')
            ok, detail = self.mod.verify_artifact_hash(
                {"artifacts": {self.rel: recorded}}, run_dir, self.rel
            )
            self.assertFalse(ok)
            self.assertIn(self.rel, detail)

    def test_missing_recorded_hash_fails_closed(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            run_dir = Path(d)
            self._write(run_dir, b'{"ok": true}')
            ok, detail = self.mod.verify_artifact_hash({"artifacts": {}}, run_dir, self.rel)
            self.assertFalse(ok)
            self.assertIn("no recorded hash", detail)

    def test_consumed_artifacts_cover_every_parsed_artifact(self):
        # The tuple must list every run artifact the script parses, so that the
        # eager verification in load_context() covers all of them.
        expected = {
            "pca/pca_2024.json",
            "kmeans/kmeans_2024_k3.json",
            "kmeans/kmeans_2024_k4.json",
            "kmeans/kmeans_2024_k5.json",
            "anomalies/anomalies_2024.json",
            "association/association_rules_2024.json",
        }
        self.assertEqual(set(self.mod.CONSUMED_ARTIFACTS), expected)

    def test_manifest_detail_names_artifact(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            run_dir = Path(d)
            recorded = self._write(run_dir, b'{"ok": true}')
            ok, detail = self.mod.verify_artifact_hash(
                {"artifacts": {self.rel: recorded}}, run_dir, self.rel
            )
            self.assertTrue(ok)
            self.assertIn(self.rel, detail)
            # Detail serialises cleanly (mirrors the checks block written to findings.json).
            json.dumps({"checks": {"artifact::pca/pca_2024.json": ok}})


if __name__ == "__main__":
    unittest.main()
