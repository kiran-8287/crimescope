"""Manifest-driven, checksum-verified raw source selection shared by pipeline scripts."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOWNLOAD_MANIFEST = ROOT / "data/raw/download_manifest_2021_2024.json"
LEGACY_2020 = {
    "year": 2020,
    "source_id": "cii_2020_1_districtwise-ipc-crimes_t1",
    "path": ROOT / "data/raw/2020/1_districtwise-ipc-crimes-2020_t1.csv",
    "state_name": "Andhra Pradesh",
    "partial": True,
    "table_id": "cii/2020/1_districtwise-ipc-crimes-2020_t1",
}


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return next(csv.reader(handle))


def load_source_inputs(root: Path = ROOT, include_2020: bool = False) -> list[dict]:
    manifest_path = root / "data/raw/download_manifest_2021_2024.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1 or manifest.get("status") != "complete":
        raise ValueError(f"Source download manifest is not complete: {manifest_path}")
    if manifest.get("index", {}).get("status") != "downloaded":
        raise ValueError("Source index was not successfully downloaded")

    entries = manifest.get("files")
    if not isinstance(entries, list) or len(entries) != manifest.get("index", {}).get("selected_fragments"):
        raise ValueError("Manifest fragment count does not match selected_fragments")
    seen_ids: set[str] = set()
    seen_paths: set[str] = set()
    normalized: list[dict] = []
    for entry in entries:
        year = int(entry["year"])
        if year not in {2021, 2022, 2023, 2024}:
            raise ValueError(f"Unexpected year in download manifest: {year}")
        if entry.get("status") not in {"downloaded_verified", "already_present_verified"}:
            raise ValueError(f"Unverified fragment in manifest: {entry.get('source_url')}")
        table_id = entry["table_id"]
        rel = Path(entry["local_path"])
        if rel.is_absolute() or ".." in rel.parts:
            raise ValueError(f"Unsafe local path in manifest: {rel}")
        path = root / rel
        if not path.is_file() or _sha256(path) != entry.get("sha256"):
            raise ValueError(f"Missing or checksum-mismatched fragment: {path}")
        if table_id in seen_ids or rel.as_posix() in seen_paths:
            raise ValueError(f"Duplicate manifest table/path: {table_id} / {rel}")
        seen_ids.add(table_id)
        seen_paths.add(rel.as_posix())
        normalized.append({**entry, "year": year, "source_id": table_id, "path": path,
                           "state_name": entry.get("state_ut_label"), "partial": False,
                           "geography_version": f"ncrb-{year}"})

    for year in (2021, 2022, 2023, 2024):
        year_items = [entry for entry in normalized if entry["year"] == year]
        if len(year_items) != int(manifest["year_summary"][str(year)]["selected"]):
            raise ValueError(f"Manifest year summary disagrees with fragment entries for {year}")
        templates = [entry for entry in year_items if entry["table_id"].endswith("_t1")]
        if len(templates) != 1 or templates[0]["state_name"] != "Andhra Pradesh":
            raise ValueError(f"Expected exactly one Andhra Pradesh header/template fragment for {year}")
        template = templates[0]
        template_header = _header(template["path"])
        expected_columns = int(template["expected_measure_columns"]) + 3
        if len(template_header) != expected_columns:
            raise ValueError(f"Template header width mismatch for {year}: {template['path']}")
        expected_table_prefix = template["table_id"].rsplit("_t", 1)[0] + "_t"
        for entry in year_items:
            if not entry["table_id"].startswith(expected_table_prefix):
                raise ValueError(f"Fragment belongs to a different table family: {entry['table_id']}")
            if len(_header(entry["path"])) != expected_columns:
                raise ValueError(f"Fragment width differs from the year template: {entry['path']}")
            entry["header_template"] = template_header
            entry["header_template_source"] = template["local_path"]

    inputs = normalized
    if include_2020:
        legacy = {**LEGACY_2020, "path": root / LEGACY_2020["path"].relative_to(ROOT),
                  "geography_version": "ncrb-2020", "header_template": _header(root / LEGACY_2020["path"].relative_to(ROOT)),
                  "header_template_source": "2020 partial Andhra Pradesh source table"}
        if not legacy["path"].is_file():
            raise FileNotFoundError(legacy["path"])
        inputs = [legacy, *inputs]
    return inputs


def dataset_source_manifest(inputs: list[dict]) -> dict:
    grouped: dict[str, list[dict]] = {}
    for item in inputs:
        grouped.setdefault(str(item["year"]), []).append({
            "table_id": item["table_id"], "state_ut_label": item.get("state_name"),
            "path": str(item["path"].relative_to(ROOT)).replace("\\", "/"),
            "sha256": _sha256(item["path"]), "partial": item.get("partial", False),
            "header_template_source": item.get("header_template_source"),
        })
    return {"years": grouped, "selection_source": "data/raw/download_manifest_2021_2024.json (active scope: 2021–2024)"}
