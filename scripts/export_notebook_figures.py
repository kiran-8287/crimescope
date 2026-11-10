#!/usr/bin/env python
"""Export embedded figures from the executed CrimeScope notebooks.

Reads the *executed* notebooks under notebooks/ and writes every embedded
figure (image/png, with image/svg+xml preserved when present) to
results/notebook_figures/<notebook-stem>/, one file per figure, using the
embedded image at its original resolution. No notebook is re-executed, no
model is refit, and no existing artifact is touched.

Each figure code cell carries a marker comment of the form::

    # Figure <figure-id> · <descriptive-name>
    # <title / short description>

The descriptive name (lowercase snake_case) becomes the file basename and the
figure id is a stable identifier (e.g. N01-01). Figures are numbered in the
order their image output appears within each notebook (`NN_descriptive_name.png`).
A composite axes figure exported from a single cell output counts as one figure
and is written as one file. Re-running overwrites the same files with identical
bytes and never creates duplicate copies or deletes unrelated files (only PNG/SVG
files owned by this exporter in the figure subfolders are refreshed).

Usage:
    python scripts/export_notebook_figures.py

Outputs:
    results/notebook_figures/
        01_data_preprocessing/
        02_statistics_and_trends/
        03_pca_and_clustering/
        04_anomalies_and_association_rules/
        figure_index.csv
        README.md
"""

from __future__ import annotations

import base64
import csv
import io
import json
import re
from pathlib import Path
from zipfile import BadZipFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOKS = ROOT / "notebooks"
OUT_ROOT = ROOT / "results" / "notebook_figures"

EXPORT_ORDER = [
    "01_data_preprocessing.ipynb",
    "02_statistics_and_trends.ipynb",
    "03_pca_and_clustering.ipynb",
    "04_anomalies_and_association_rules.ipynb",
]

FIGURE_MARKER = re.compile(r"^#\s*Figure\s+(\S+)\s*·\s*(.+)\s*$")


def iter_image_outputs(nb):
    """Yield (cell_index, output_index, output) for every embedded image output."""
    for cell_index, cell in enumerate(nb.get("cells", [])):
        if cell.get("cell_type") != "code":
            continue
        for output_index, output in enumerate(cell.get("outputs", [])):
            if output.get("output_type") not in ("display_data", "execute_result"):
                continue
            data = output.get("data", {})
            if "image/png" not in data and "image/svg+xml" not in data:
                continue
            yield cell_index, output_index, output


def decode_b64(value):
    if isinstance(value, list):
        value = "".join(value)
    return base64.b64decode(value)


def validate_image(data, mime):
    with Image.open(io.BytesIO(data)) as im:
        im.load()
        if mime == "image/png" and im.format != "PNG":
            raise ValueError(f"expected PNG, got {im.format}")


def validate_svg(text):
    text = text.strip()
    if not text.startswith("<svg") and "<svg" not in text[:1024]:
        raise ValueError("does not look like an SVG document")


def parse_figure_cell(cell_source):
    """Return (figure_id, basename, title) parsed from the cell's marker comments.

    Returns (None, None, None) when the cell carries no figure marker.
    """
    if isinstance(cell_source, list):
        cell_source = "".join(cell_source)
    lines = cell_source.splitlines()
    fig_id = basename = title = None
    for i, line in enumerate(lines):
        m = FIGURE_MARKER.match(line.strip())
        if m:
            fig_id = m.group(1)
            basename = m.group(2).strip().lower().replace(" ", "_")
            # Drop meta-commentary parentheticals (optional / improved / replaces ...) so
            # the file basename stays a clean descriptive topic.
            basename = re.sub(
                r"\s*\((?:optional[^)]*|improved[^)]*|replaces[^)]*)\)\s*$", "", basename
            ).strip("_")
            # The next comment line, if any, is the title/short description.
            for j in range(i + 1, min(i + 4, len(lines))):
                nxt = lines[j].strip()
                if nxt.startswith("#"):
                    title = nxt.lstrip("#").strip().rstrip(",. ")
                    break
                if nxt and not nxt.startswith("#"):
                    break
            break
    return fig_id, basename, title


def main():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    index_rows = []
    per_notebook_counts = {}
    exported_paths = set()  # relative paths written this run
    skipped = []

    for nb_name in EXPORT_ORDER:
        nb_path = NOTEBOOKS / nb_name
        stem = nb_name.removesuffix(".ipynb")
        out_dir = OUT_ROOT / stem
        out_dir.mkdir(parents=True, exist_ok=True)

        nb = json.loads(nb_path.read_text(encoding="utf-8"))
        count = 0
        ordinal = 0
        for cell_index, output_index, output in iter_image_outputs(nb):
            fig_id, basename, title = parse_figure_cell(
                nb["cells"][cell_index].get("source", "")
            )
            if basename is None:
                skipped.append({
                    "notebook": nb_name,
                    "cell": str(cell_index),
                    "output": str(output_index),
                    "reason": "embedded image output has no figure marker",
                })
                continue

            ordinal += 1
            data = output.get("data", {})
            paths = []

            if "image/png" in data:
                png_bytes = decode_b64(data["image/png"])
                validate_image(png_bytes, "image/png")
                filename = f"{ordinal:02d}_{basename}.png"
                (out_dir / filename).write_bytes(png_bytes)
                paths.append(f"{stem}/{filename}")

            if "image/svg+xml" in data:
                svg_text = decode_b64(data["image/svg+xml"]).decode("utf-8")
                validate_svg(svg_text)
                filename = f"{ordinal:02d}_{basename}.svg"
                (out_dir / filename).write_text(svg_text, encoding="utf-8")
                paths.append(f"{stem}/{filename}")

            if not paths:
                skipped.append({
                    "notebook": nb_name,
                    "cell": str(cell_index),
                    "output": str(output_index),
                    "reason": "no decodable image payload in output",
                })
                continue

            count += 1
            exported_paths.update(paths)
            year = ""
            m_year = re.search(r"\b(20\d{2})\b", (title or basename))
            if m_year:
                year = m_year.group(1)
            index_rows.append({
                "source_notebook": nb_name,
                "figure_id": fig_id or basename,
                "cell_index": str(cell_index),
                "output_index": str(output_index),
                "figure_title": title or basename.replace("_", " "),
                "cohort_year": year,
                "description": title or "",
                "export_paths": "; ".join(paths),
            })

        per_notebook_counts[nb_name] = count

    # Superseded-file cleanup: remove PNG/SVG owned by this exporter that are no
    # longer in the current inventory (never touches figure_index.csv/README or
    # files outside the four figure subfolders).
    for sub in EXPORT_ORDER:
        sub_stem = sub.removesuffix(".ipynb")
        sub_dir = OUT_ROOT / sub_stem
        if sub_dir.is_dir():
            for f in list(sub_dir.glob("*.png")) + list(sub_dir.glob("*.svg")):
                rel = f"{sub_stem}/{f.name}"
                if rel not in exported_paths:
                    f.unlink()

    # figure_index.csv - one row per figure, stable order
    index_path = OUT_ROOT / "figure_index.csv"
    with index_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "source_notebook", "figure_id", "cell_index", "output_index",
                "figure_title", "cohort_year", "description", "export_paths",
            ],
        )
        writer.writeheader()
        writer.writerows(index_rows)

    # README.md
    readme_lines = [
        "# Notebook figure exports",
        "",
        "Embedded figures from the four executed CrimeScope notebooks, exported at their "
        "original resolution directly from the notebook outputs (no re-execution, no refit).",
        "",
        "## Folder layout",
        "",
        "| Notebook | Folder | Figures exported |",
        "| --- | --- | --- |",
    ]
    for nb_name in EXPORT_ORDER:
        stem = nb_name.removesuffix(".ipynb")
        count = per_notebook_counts.get(nb_name, 0)
        readme_lines.append(
            f"| `{nb_name}` | `results/notebook_figures/{stem}/` | {count} |"
        )
    readme_lines += [
        "",
        f"Total figures exported: {sum(per_notebook_counts.values())}.",
        "",
        "`01_data_preprocessing/` contains embedded figures (PNG); its earlier outputs were "
        "HTML tables and printed text, now supplemented by the figures above.",
        "",
        "## File naming",
        "",
        "Files are named `NN_descriptive_name.png` (lowercase snake_case), numbered in the "
        "order the figure output appears within its notebook. `NN` resets per notebook. An "
        "SVG is exported alongside the PNG with the same basename whenever the notebook "
        "supplies one. Each figure code cell carries a stable marker (`# Figure <id> · "
        "<name>`) so adding a later plot does not rename unrelated files.",
        "",
        "## How to find a figure",
        "",
        "Open `results/notebook_figures/figure_index.csv`. Each row gives the source notebook, "
        "the stable figure id, the cell and output position, a short title, cohort/year, a "
        "description, and the relative export path(s).",
        "",
        "## How to repeat the export",
        "",
        "From the repository root, run:",
        "",
        "```powershell",
        "python scripts/export_notebook_figures.py",
        "```",
        "",
        "The script writes the same files with identical bytes on every run. It never creates "
        "timestamped copies, never deletes unrelated files, and never modifies the notebooks, "
        "datasets, or saved model artifacts.",
        "",
    ]
    if skipped:
        readme_lines += [
            "## Skipped / unsupported outputs",
            "",
            "The following embedded image outputs were found but not exported:",
            "",
        ]
        for s in skipped:
            readme_lines.append(
                f"- `{s['notebook']}` cell[{s['cell']}] output[{s['output']}] - {s['reason']}"
            )
        readme_lines.append("")
    (OUT_ROOT / "README.md").write_text("\n".join(readme_lines) + "\n", encoding="utf-8")

    print(f"Exported {sum(per_notebook_counts.values())} figure(s) to {OUT_ROOT}")
    for nb_name in EXPORT_ORDER:
        print(f"  {nb_name}: {per_notebook_counts.get(nb_name, 0)}")
    if skipped:
        print("Skipped:")
        for s in skipped:
            print(f"  {s['notebook']} cell[{s['cell']}] output[{s['output']}]: {s['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
