"""Create source-header category roles without changing observation IDs."""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "analysis" / "src"))
sys.path.insert(0, str(ROOT / "scripts"))
from crimescope_analysis.cleaning.canonical import category_display_labels, stable_id
from source_inputs import load_source_inputs


def category_identity(label: str) -> tuple[str, str]:
    return stable_id("cat", label), label


def classify(header: str, label: str) -> str:
    leaf = header.split(" | ")[-1] if " | " in header else header
    if label.casefold().startswith("total cognizable"):
        return "official_total"
    if re.search(r"\btotal\b", leaf, re.IGNORECASE):
        return "parent_total"
    if re.match(r"^[a-z]\)", label, re.IGNORECASE):
        return "component"
    return "leaf"


def build() -> dict:
    catalog: dict[str, dict] = {}
    source_hashes = {}
    # Build the active taxonomy from the verified 2021–2024 source set. The
    # partial 2020 source remains historical and is not required for this catalog.
    inputs = load_source_inputs(ROOT)
    templates = [source for source in inputs if source["table_id"].endswith("_t1")]
    for source in templates:
        year, path = source["year"], source["path"]
        relative = str(path.relative_to(ROOT)).replace("\\", "/")
        source_hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            header = next(csv.reader(handle))
        labels = category_display_labels(header[3:])
        for raw_header, label in zip(header[3:], labels):
            identifier, label = category_identity(label)
            item = catalog.setdefault(identifier, {"id": identifier, "label": label, "years": [], "rolesByYear": {}, "sourceHeaders": {}})
            if year not in item["years"]:
                item["years"].append(year)
            roles = item["rolesByYear"].setdefault(str(year), set())
            roles.add(classify(raw_header, label))
            item["sourceHeaders"].setdefault(str(year), []).append(raw_header)
    for item in catalog.values():
        item["years"].sort()
        item["rolesByYear"] = {year: sorted(roles) for year, roles in item["rolesByYear"].items()}
        item["sourceHeaders"] = {year: sorted(set(headers)) for year, headers in item["sourceHeaders"].items()}
    return {
        "version": 1,
        "generatedFrom": source_hashes,
        "roleDefinitions": {
            "official_total": "Source label begins Total Cognizable; the reported official total row.",
            "parent_total": "Source column leaf contains Total; an aggregate/subtotal. Excluded from leaf-feature methods.",
            "component": "Enumerated source leaf such as a) or b); retained as a feature but not assumed additive across the full catalogue.",
            "leaf": "Other source leaf; retained as a feature, not asserted mutually exclusive across crime categories.",
        },
        "compositionSharesAvailable": False,
        "compositionSharesReason": "No complete validated mutually-exclusive category mapping exists across these source tables; category shares are disabled.",
        "pcaFeatureRoles": ["leaf", "component"],
        "categories": sorted(catalog.values(), key=lambda item: (item["label"].casefold(), item["id"])),
    }


if __name__ == "__main__":
    output = ROOT / "config/category_hierarchy.json"
    output.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {output}")
