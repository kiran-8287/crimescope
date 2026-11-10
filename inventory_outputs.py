#!/usr/bin/env python
"""Inventory notebook outputs (images, html tables, text) cell by cell."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

for nb_path in sorted((ROOT / "notebooks").glob("*.ipynb")):
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    print(f"\n=== {nb_path.name} ===")
    print(f"cells: {len(nb['cells'])}")
    for ci, cell in enumerate(nb["cells"]):
        if cell["cell_type"] != "code":
            continue
        outputs = cell.get("outputs", [])
        if not outputs:
            continue
        has_image = any(o.get("output_type") in ("display_data", "execute_result") and any(k in o.get("data", {}) for k in ("image/png", "image/svg+xml")) for o in outputs)
        if not has_image:
            continue
        for oi, o in enumerate(outputs):
            if o.get("output_type") not in ("display_data", "execute_result"):
                continue
            data = o.get("data", {})
            imgs = {k for k in ("image/png", "image/svg+xml") if k in data}
            if not imgs:
                continue
            text_src = ""
            src = cell.get("source", [])
            if isinstance(src, list):
                text_src = "".join(src)
            else:
                text_src = src
            first_line = text_src.strip().splitlines()[0][:110] if text_src.strip() else ""
            print(f"  cell[{ci}] output[{oi}] {oi}: images={sorted(imgs)} | src: {first_line}")
