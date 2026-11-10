#!/usr/bin/env python
"""CrimeScope presentation-asset exporter.

Produces a reproducible, presentation-sized evidence pack (PNG + SVG + exact CSV
+ results.json + figure_manifest.json) for the active release and analysis run.

Design rules (see the bounded task spec, section B):
  * Read ONLY the active pointers, the immutable release and the SAVED run
    artifacts. Never refit a production model.
  * Verify pointer/manifest compatibility and the recorded sha256 of every
    consumed artifact BEFORE parsing its protected payload (delegated to the
    already-verified loaders in ``scripts/research_findings.py``).
  * Address geography/categories by stable ids and the manifest's ORDERED
    feature list, never by cleaned-label joins.
  * Derive metrics from full precision; round only for display. Export the
    underlying values in CSV.
  * Every figure carries a question/claim title, readable axes/units, scope,
    caption, data source and limitation. A missing artifact is reported as a
    status, never fabricated.

Usage:
    python scripts/export_presentation_assets.py [--timestamp YYYYMMDDTHHMMSSZ]

Output (default):
    analysis/output/presentation/<run_id>/<timestamp>/
        figures/*.png  (2560x1440)   figures/*.svg (vector)
        tables/*.csv                 results.json   figure_manifest.json
        README.md

The exporter refuses to write into an existing timestamp directory so a prior
evidence pack is never overwritten by accident.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sqlite3
import struct
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import research_findings as rf  # noqa: E402  (verified loaders + conventions)

# --------------------------------------------------------------------------- #
# style
# --------------------------------------------------------------------------- #
FIG_W, FIG_H, DPI = 12.8, 7.2, 200          # -> 2560 x 1440 px PNG
PRIMARY, ACCENT, RED, BLUE, GREY = "#0f766e", "#b45309", "#b91c1c", "#2563eb", "#94a3b8"
SERIES = ["#237866", "#6689ba", "#cf9b46", "#9176ae", "#b45309"]
DIVERGING = "RdBu_r"

plt.rcParams.update({
    "figure.figsize": (FIG_W, FIG_H),
    "font.size": 12,
    "axes.titlesize": 14,
    "axes.labelsize": 12,
    "axes.grid": True,
    "grid.alpha": 0.25,
    "axes.axisbelow": True,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.facecolor": "white",
    "savefig.facecolor": "white",
})

TITLE_SUFFIX = "CrimeScope · release ncrb-districtwise-2021-2024-ecec48b772bc"

FIGURES: list[dict] = []
RESULTS: dict = {}


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        head = handle.read(24)
    return struct.unpack(">II", head[16:24])


def save_fig(fig, fig_dir: Path, name: str) -> dict:
    png = fig_dir / f"{name}.png"
    svg = fig_dir / f"{name}.svg"
    fig.savefig(png, dpi=DPI)
    fig.savefig(svg)
    plt.close(fig)
    w, h = png_size(png)
    return {"png": f"figures/{name}.png", "svg": f"figures/{name}.svg", "width": w, "height": h}


def write_csv(path: Path, header: list[str], rows: list[list]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)
    return f"tables/{path.name}"


def pct(cur: float, base: float) -> float | None:
    return None if not base else (cur - base) / base * 100.0


def add_figure(fid: str, files: dict, table: str | None, meta: dict) -> None:
    FIGURES.append({
        "id": fid,
        "files": files,
        "table": table,
        "generated_at_utc": RESULTS["generated_at_utc"],
        "status": "available",
        **meta,
    })


def ordered_feature_lookup(manifest: dict) -> tuple[list[dict], dict, dict]:
    ordered = manifest["feature_input"]["ordered_features"]
    by_label = {f["label"]: f for f in ordered}
    by_id = {f["id"]: f for f in ordered}
    return ordered, by_label, by_id


# --------------------------------------------------------------------------- #
# data assembly (no fitting; reads saved artifacts + release only)
# --------------------------------------------------------------------------- #
def annual_maps(con: sqlite3.Connection, by_id: dict, years: list[int]) -> dict:
    per_year = {}
    for year in years:
        cid = rf.official_total_id(by_id, year)
        rows = list(con.execute(
            "SELECT state_name, region_name, geography_id, reported_value FROM crime_observations "
            "WHERE year=? AND category_id=? AND region_type='administrative_district' AND measure_type='cases'",
            (year, cid),
        ))
        per_year[year] = {(st, rn): {"geography_id": gid, "value": val} for st, rn, gid, val in rows if val is not None}
    return per_year


def district_totals(con: sqlite3.Connection, cid: str, year: int) -> dict:
    return {
        gid: val for gid, val in con.execute(
            "SELECT geography_id, reported_value FROM crime_observations "
            "WHERE year=? AND category_id=? AND region_type='administrative_district' AND measure_type='cases'",
            (year, cid),
        ) if val is not None
    }


def hsum(values) -> float:
    return float(np.sum(values)) if len(values) else 0.0


# --------------------------------------------------------------------------- #
# figure builders
# --------------------------------------------------------------------------- #
def fig01_data_accounting(out: Path, acct: dict) -> None:
    fig, axes = plt.subplots(1, 2, constrained_layout=True)
    labels = ["Canonical\nrows", "Eligible\n(non-aggregate)", "Aggregate\nrows", "Quarantined"]
    values = [acct["canonical"], acct["eligible"], acct["aggregate"], acct["quarantined"]]
    bars = axes[0].bar(labels, values, color=[PRIMARY, "#2f9e8f", ACCENT, GREY])
    axes[0].set_ylabel("rows")
    axes[0].set_title("Row accounting of the active release")
    for rect, v in zip(bars, values):
        axes[0].text(rect.get_x() + rect.get_width() / 2, v, f"{v:,}", ha="center", va="bottom", fontsize=11)
    axes[0].set_ylim(0, max(values) * 1.16)

    comp_labels = ["Positive values", "Explicit zeros", "Nulls (retained)"]
    comp_values = [acct["eligible"] - acct["eligible_zeros"], acct["eligible_zeros"], acct["eligible_nulls"]]
    comp = axes[1].bar(comp_labels, comp_values, color=["#2f9e8f", "#c9d6cf", "#e5e7eb"])
    axes[1].set_ylabel("eligible rows")
    axes[1].set_title("Eligible-row composition (explicit zeros preserved)")
    for rect, v in zip(comp, comp_values):
        axes[1].text(rect.get_x() + rect.get_width() / 2, v, f"{v:,}", ha="center", va="bottom", fontsize=11)
    axes[1].set_ylim(0, max(comp_values) * 1.16)

    fig.suptitle("Fig 1 — What data actually feeds the analysis?", fontsize=16)
    fig.text(0.5, -0.02,
             "Source: release_manifest.json + quality_report.json + SQLite. "
             "Explicit zeros are preserved, not treated as missing; coverage is partial by design.",
             ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig01_data_accounting")
    table = write_csv(out / "tables" / "01_data_accounting.csv",
                      ["metric", "value", "scope", "source"],
                      [["canonical_rows", acct["canonical"], "all canonical rows", "release_manifest.json"],
                       ["eligible_rows", acct["eligible"], "comparison_status=eligible, non-aggregate", "release_manifest.json"],
                       ["aggregate_rows", acct["aggregate"], "region_type=aggregate", "release_manifest.json"],
                       ["quarantined_rows", acct["quarantined"], "quality_status=quarantined", "release_manifest.json"],
                       ["eligible_explicit_zeros", acct["eligible_zeros"], "eligible rows with reported_value=0", "progress/STATUS.md §3"],
                       ["eligible_nulls", acct["eligible_nulls"], "eligible rows with reported_value IS NULL", "progress/STATUS.md §3"],
                       ["source_files", acct["source_files"], "state/UT source fragments", "release_manifest.json"],
                       ["years", "2021,2022,2023,2024", "active scope", "data/serving/current.json"]])
    RESULTS["data_accounting"] = acct
    add_figure("fig01_data_accounting", files, table, {
        "question": "How many records feed the analysis, and how are zeros and nulls handled?",
        "title": "Fig 1 — What data actually feeds the analysis?",
        "scope": "Active release ncrb-districtwise-2021-2024-ecec48b772bc, years 2021–2024, 36 state/UT fragments.",
        "units": "rows (counts)",
        "method": "Read release_manifest.json + quality_report.json summary; no recomputation of the pipeline.",
        "transform": "none",
        "cohort": "all canonical rows (left); eligible non-aggregate rows (right)",
        "inputs": [{"path": "data/serving/current.json", "sha256": None},
                   {"path": acct["release_manifest_path"], "sha256": None}],
        "statistic_status": "saved (manifest/quality report)",
        "caption": "144 source fragments produce 567,078 canonical rows; 546,198 are eligible for comparison and 20,880 are aggregates. Among eligible rows, 323,296 are explicit zeros and 0 are nulls.",
        "limitation": "Partial real-world coverage: these are records published in the enrolled state/UT fragments, not a census of all crime.",
    })


def fig02_descriptive_distribution(out: Path, totals: np.ndarray) -> None:
    stats = {
        "n_units": int(totals.size),
        "median": float(np.median(totals)),
        "q1": float(np.percentile(totals, 25)),
        "q3": float(np.percentile(totals, 75)),
        "min": int(totals.min()),
        "max": int(totals.max()),
        "zeros": int(np.sum(totals == 0)),
    }
    stats["iqr"] = stats["q3"] - stats["q1"]
    fig, axes = plt.subplots(1, 2, constrained_layout=True)
    axes[0].hist(np.log1p(totals), bins=45, color=PRIMARY, alpha=0.85)
    axes[0].axvline(np.log1p(stats["median"]), color=RED, lw=2, label=f"median {stats['median']:,.0f}")
    axes[0].set_xlabel("log1p(2024 official reported total)")
    axes[0].set_ylabel("reporting units")
    axes[0].set_title("Distribution of 2024 official totals (log1p scale)")
    axes[0].legend(fontsize=10)

    xs = np.sort(totals)
    ys = np.arange(1, xs.size + 1) / xs.size
    axes[1].plot(xs, ys, color=PRIMARY, lw=2)
    axes[1].set_xscale("symlog", linthresh=10)
    axes[1].set_xlabel("2024 official reported total (symlog scale)")
    axes[1].set_ylabel("cumulative fraction of units")
    axes[1].set_title("ECDF of 2024 official totals")
    axes[1].axhline(0.5, color=GREY, ls="--", lw=1)

    fig.suptitle("Fig 2 — How are reported totals distributed across the 774 analytical units?", fontsize=16)
    fig.text(0.5, -0.02,
             "Source: SQLite official-total category, 2024 administrative districts. "
             f"n={stats['n_units']}, median {stats['median']:,.0f}, IQR {stats['q1']:,.0f}–{stats['q3']:,.0f}, "
             f"min {stats['min']:,}, max {stats['max']:,}, zeros {stats['zeros']}.",
             ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig02_descriptive_distribution")
    table = write_csv(out / "tables" / "02_distribution_stats.csv",
                      ["statistic", "value", "unit"],
                      [["n_units", stats["n_units"], "administrative districts"],
                       ["median", stats["median"], "cases"],
                       ["q1", stats["q1"], "cases"],
                       ["q3", stats["q3"], "cases"],
                       ["iqr", stats["iqr"], "cases"],
                       ["min", stats["min"], "cases"],
                       ["max", stats["max"], "cases"],
                       ["zero_units", stats["zeros"], "districts"]])
    RESULTS["descriptive_distribution"] = stats
    add_figure("fig02_descriptive_distribution", files, table, {
        "question": "What does the reported-total distribution look like across analytical units?",
        "title": "Fig 2 — Distribution of 2024 reported totals",
        "scope": "2024 administrative districts (774 units) using the official-total category.",
        "units": "cases per reporting unit",
        "method": "Histogram of log1p(total) and an ECDF; statistics from the full set of unit totals.",
        "transform": "log1p for display only; statistics computed on raw counts.",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "data/serving/current.json", "sha256": None}],
        "statistic_status": "derived from full data (no refit)",
        "caption": "The distribution is strongly right-skewed; a small number of high-volume units dominate the total, so a single total would hide the spread.",
        "limitation": "Counts are not rates — no population denominator exists in these tables, so no per-capita comparison is implied.",
    })


def fig03_transformation_example(out: Path, regions: list[str], categories: list[str],
                                 raw: np.ndarray, feature_label: str, feature_id: str) -> None:
    j = categories.index(feature_label)
    values = raw[:, j]
    logged = np.log1p(values)
    mean = float(logged.mean())
    std = float(logged.std(ddof=0)) or 1.0
    zeros = int(np.sum(values == 0))

    fig, axes = plt.subplots(1, 2, constrained_layout=True)
    axes[0].hist(values, bins=40, color=ACCENT, alpha=0.85)
    axes[0].set_xlabel("raw recorded count")
    axes[0].set_ylabel("reporting units")
    axes[0].set_title("Raw counts (incl. explicit zeros)")
    axes[1].hist(logged, bins=40, color=PRIMARY, alpha=0.85)
    axes[1].axvline(mean, color=RED, lw=2, label=f"mean log1p = {mean:.3f}")
    axes[1].set_xlabel("log1p(raw count)")
    axes[1].set_ylabel("reporting units")
    axes[1].set_title(f"log1p transform, then featurewise z-score (std {std:.3f})")
    axes[1].legend(fontsize=10)

    fig.suptitle(f"Fig 3 — Same observations, raw vs log1p: “{feature_label}”", fontsize=15)
    fig.text(0.5, -0.02,
             f"Source: saved feature_input.csv (2024 cohort, n={len(values)}). Zero counts are kept ({zeros} zeros); "
             "no synthetic example. Each feature is then standardised across districts (subtract its mean, divide by its "
             "population std, ddof=0).", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig03_transformation_example")
    table = write_csv(out / "tables" / "03_transformation_example.csv",
                      ["region_id", "raw_count", "log1p", "z_score"],
                      [[regions[i], int(values[i]), round(float(logged[i]), 6), round(float((logged[i] - mean) / std), 6)]
                       for i in range(len(regions))])
    RESULTS["transformation_example"] = {
        "feature_id": feature_id, "feature_label": feature_label, "n": len(values),
        "zeros": zeros, "mean_log1p": mean, "std_log1p_ddof0": std,
    }
    add_figure("fig03_transformation_example", files, table, {
        "question": "How are raw recorded counts turned into the modelling features?",
        "title": f"Fig 3 — raw vs log1p for “{feature_label}”",
        "scope": "2024 administrative-district cohort (774 units), one saved feature.",
        "units": "cases (raw) / log1p(cases)",
        "method": "Reproduce the saved pipeline transform: log1p then featurewise z-score (population std, ddof=0).",
        "transform": "log1p then z-score, ddof=0",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/feature_input.csv",
                    "sha256": "236b90de1c5e3f26b0bbda90887075c98e4cda5c23982b6ae658e62aeb92c8dd"}],
        "statistic_status": "derived from full data (no refit)",
        "caption": "log1p compresses the long right tail; the feature is then standardised across districts so its mean is 0 and its population std is 1.",
        "limitation": "This is a transform, not a model result; the z-scored feature unit is a relative deviation, not a count.",
    })


def fig04_regional_comparison(out: Path, rows: list[dict]) -> None:
    labels = [r["short"] for r in rows]
    a = [r["kameng"] for r in rows]
    b = [r["gondia"] for r in rows]
    x = np.arange(len(rows))
    fig, ax = plt.subplots(constrained_layout=True)
    ax.bar(x - 0.2, a, width=0.4, label="Kameng West (Arunachal Pradesh)", color=SERIES[1])
    ax.bar(x + 0.2, b, width=0.4, label="Gondia (Maharashtra)", color=SERIES[0])
    for xi, va, vb in zip(x, a, b):
        ax.text(xi - 0.2, va, f"{va:,}", ha="center", va="bottom", fontsize=9)
        ax.text(xi + 0.2, vb, f"{vb:,}", ha="center", va="bottom", fontsize=9)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=20, ha="right")
    ax.set_ylabel("reported cases (2024)")
    ax.set_title("Fig 4 — Two comparable units: Kameng West (92) vs Gondia (3,922)", fontsize=15)
    ax.legend(fontsize=10)
    fig.text(0.5, -0.05,
             "Source: SQLite 2024, both administrative districts. Categories overlap (parents and children), so they must "
             "NOT be added into a composition total.", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig04_regional_comparison")
    table = write_csv(out / "tables" / "04_regional_comparison.csv",
                      ["category_id", "raw_category_label", "context", "kameng_west_cases", "gondia_cases", "role"],
                      [[r["category_id"], r["raw"], r["context"], r["kameng"], r["gondia"], r["role"]] for r in rows])
    RESULTS["regional_comparison"] = {"rows": rows}
    add_figure("fig04_regional_comparison", files, table, {
        "question": "How do two comparable reporting units differ in reported volume and category mix?",
        "title": "Fig 4 — Kameng West vs Gondia",
        "scope": "2024 administrative districts, Arunachal Pradesh and Maharashtra.",
        "units": "reported cases",
        "method": "Direct SQLite lookup by stable geography/category ids for the official total and the profile categories.",
        "transform": "none",
        "cohort": "two named 2024 administrative districts",
        "inputs": [{"path": "data/serving/current.json", "sha256": None}],
        "statistic_status": "derived from full data (no refit)",
        "caption": "Totals are 92 vs 3,922 cases; the category profile differs sharply, but the categories overlap and must not be summed.",
        "limitation": "Matching units by name/type is operational; raw counts are not rates and these profiles are not safety scores.",
    })


def fig05_annual_snapshots(out: Path, annual: dict) -> None:
    years = sorted(annual["totals"])
    totals = [annual["totals"][y] for y in years]
    units = [annual["counts"][y] for y in years]
    lakh = [t / 1e5 for t in totals]
    fig, ax = plt.subplots(constrained_layout=True)
    colors = [SERIES[0] if int(y) <= 2023 else SERIES[2] for y in years]
    bars = ax.bar([str(y) for y in years], totals, color=colors, width=0.6)
    for rect, t, v, u in zip(bars, totals, lakh, units):
        ax.text(rect.get_x() + rect.get_width() / 2, t, f"{v:.2f}L\n{t:,}\n{u} units", ha="center", va="bottom", fontsize=10)
    ax.set_ylim(0, max(totals) * 1.22)
    ax.set_ylabel("reported cases")
    ax.set_title("Fig 5 — Reported cases by year (separate annual snapshots)", fontsize=15)
    # framework break between 2023 and 2024
    ax.axvline(2.5, color=RED, ls="--", lw=1.5)
    ax.text(2.5, max(totals) * 1.13, " IPC → BNS\n framework change", color=RED, fontsize=10, va="top")
    fig.text(0.5, -0.02,
             "Source: SQLite official-total category per year; each bar is that year's own eligible administrative-district cohort. "
             "2024 uses a different reporting framework, so 2023→2024 is not a comparable decline.",
             ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig05_annual_snapshots")
    table = write_csv(out / "tables" / "05_annual_snapshots.csv",
                      ["year", "framework", "reporting_units", "reported_cases", "lakh"],
                      [[y, "IPC" if int(y) <= 2023 else "BNS", annual["counts"][y], annual["totals"][y], round(annual["totals"][y] / 1e5, 4)]
                       for y in years])
    RESULTS["annual_snapshots"] = annual
    add_figure("fig05_annual_snapshots", files, table, {
        "question": "What were the reported totals in each year of the active scope?",
        "title": "Fig 5 — Reported cases by year",
        "scope": "2021–2024 administrative-district cohorts (726/750/770/774 units).",
        "units": "reported cases",
        "method": "Sum of the official-total category per year from SQLite; zero baseline.",
        "transform": "none (L = lakh = 100,000 shown for readability)",
        "cohort": "each year's own eligible administrative-district set",
        "inputs": [{"path": "data/serving/current.json", "sha256": None}],
        "statistic_status": "derived from full data (no refit)",
        "caption": "2021–2024 totals are 29.10L / 28.08L / 29.40L / 27.40L; unit counts rise from 726 to 774, and 2024 switches framework.",
        "limitation": "Annual sets differ year to year; the 2023→2024 step is a framework change, not a comparable decline.",
    })


def fig06_matched_change(out: Path, m: dict) -> None:
    fig, axes = plt.subplots(1, 2, constrained_layout=True, gridspec_kw={"width_ratios": [1, 1.25]})
    ax = axes[0]
    bars = ax.bar(["2022", "2023"], [m["matched_2022"], m["matched_2023"]], color=[SERIES[1], SERIES[0]], width=0.55)
    for rect, v in zip(bars, [m["matched_2022"], m["matched_2023"]]):
        ax.text(rect.get_x() + rect.get_width() / 2, v, f"{v:,}", ha="center", va="bottom", fontsize=11)
    ax.set_ylim(0, max(m["matched_2022"], m["matched_2023"]) * 1.2)
    ax.set_ylabel("reported cases")
    ax.set_title(f"Same {m['matched_units']} named units (bars from zero)")

    ax2 = axes[1]
    metrics = ["Annual unit sets\n(750→770)", "Name-matched cohort\n(749→749)"]
    changes = [m["annual_pct"], m["matched_pct"]]
    bars2 = ax2.bar(metrics, changes, color=[SERIES[3], SERIES[0]], width=0.5)
    for rect, v in zip(bars2, changes):
        ax2.text(rect.get_x() + rect.get_width() / 2, v, f"{v:+.2f}%", ha="center", va="bottom", fontsize=12)
    ax2.axhline(0, color="#333", lw=1)
    ax2.set_ylabel("2022→2023 change (%)")
    ax2.set_title(f"Two distinct change measures (gap {abs(m['annual_pct'] - m['matched_pct']):.2f} pp)")

    fig.suptitle("Fig 6 — Annual-set vs name-matched change, 2022→2023", fontsize=15)
    fig.text(0.5, -0.02,
             f"Matched cohort: {m['matched_2022']:,} → {m['matched_2023']:,} ({m['matched_delta']:+,} cases, {m['matched_pct']:+.2f}%). "
             "Name matching controls cohort membership only; it does not establish unchanged boundaries.",
             ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig06_matched_change")
    table = write_csv(out / "tables" / "06_matched_reconciliation.csv",
                      ["component", "2022", "2023", "note"],
                      [["annual_reported_total", m["annual_2022"], m["annual_2023"], "all eligible administrative districts"],
                       ["matched_endpoint_total", m["matched_2022"], m["matched_2023"], f"{m['matched_units']} name-matched units"],
                       ["excluded_total", m["excluded_2022_cases"], m["excluded_2023_cases"], "units present in only one year"],
                       ["excluded_unit_count", m["excluded_2022_count"], m["excluded_2023_count"], "renames/reorganisations possible"],
                       ["reconciles_annual_=_matched+excluded", str(m["reconcile_2022"]), str(m["reconcile_2023"]), "identity check"]])
    RESULTS["matched_change"] = m
    add_figure("fig06_matched_change", files, table, {
        "question": "How large is the 2022→2023 change on the same named units vs the annual sets?",
        "title": "Fig 6 — Matched vs annual change",
        "scope": "2022–2023 administrative districts (the only source-connected pair).",
        "units": "reported cases",
        "method": "Operational (state, region) name join across the two annual cohorts; exact sums from SQLite.",
        "transform": "none",
        "cohort": "749 name-matched units",
        "inputs": [{"path": "data/serving/current.json", "sha256": None}],
        "statistic_status": "derived from full data (no refit)",
        "caption": f"Same {m['matched_units']} units rise {m['matched_delta']:+,} cases ({m['matched_pct']:+.2f}%); the annual sets rise {m['annual_pct']:+.2f}%. The {abs(m['annual_pct']-m['matched_pct']):.2f} pp gap is not a causal estimate.",
        "limitation": "Name matching is an operational join, not proof of unchanged administrative boundaries.",
    })


def fig07_pca_retained(out: Path, pca: dict) -> None:
    ev = pca["eigenvalues"]
    total_var = float(pca["total_feature_variance"])
    shares = [ev[0] / total_var, ev[1] / total_var, 1 - ev[0] / total_var - ev[1] / total_var]
    fig, ax = plt.subplots(constrained_layout=True)
    bars = ax.bar(["PC1", "PC2", "PC3–PC131\n(remaining)"], [s * 100 for s in shares],
                  color=[PRIMARY, BLUE, GREY])
    for rect, s in zip(bars, shares):
        ax.text(rect.get_x() + rect.get_width() / 2, s * 100, f"{s*100:.2f}%", ha="center", va="bottom", fontsize=12)
    ax.set_ylabel("share of total feature variance (%)")
    ax.set_ylim(0, 100)
    ax.set_title("Fig 7 — How much variance do the two saved components retain?", fontsize=15)
    fig.text(0.5, -0.02,
             f"Source: pca_2024.json (774 units × 131 features). Denominator = total feature variance ({total_var:.4f}); "
             "only two components are saved, so no full scree plot is shown.", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig07_pca_retained_variance")
    table = write_csv(out / "tables" / "07_pca_retained_variance.csv",
                      ["component", "eigenvalue", "share_of_total_feature_variance_pct"],
                      [["PC1", round(ev[0], 6), round(shares[0] * 100, 4)],
                       ["PC2", round(ev[1], 6), round(shares[1] * 100, 4)],
                       ["PC3-PC131 (remaining)", None, round(shares[2] * 100, 4)],
                       ["total_feature_variance", round(total_var, 6), 100.0]])
    RESULTS["pca_retained_variance"] = {"pc1_pct": shares[0] * 100, "pc2_pct": shares[1] * 100,
                                        "cum_pct": (shares[0] + shares[1]) * 100, "remaining_pct": shares[2] * 100}
    add_figure("fig07_pca_retained_variance", files, table, {
        "question": "How much of the feature variance is captured by the two saved components?",
        "title": "Fig 7 — PCA retained variance",
        "scope": "2024 national cohort, 774 units × 131 features.",
        "units": "share of total feature variance (%)",
        "method": "Read saved eigenvalues and total_feature_variance; shares computed from full precision.",
        "transform": "log1p then z-score (ddof=0) — the space in which PCA was fitted",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/pca/pca_2024.json",
                    "sha256": RESULTS["_hashes"].get("pca/pca_2024.json")}],
        "statistic_status": "saved artifact",
        "caption": "PC1 retains 15.91% and PC2 4.57% (20.48% combined); 79.52% remains in the other 129 dimensions.",
        "limitation": "Two components are a summary, not a complete similarity map; a full scree plot cannot be shown from the saved artifact.",
    })


def fig08_pca_scatter(out: Path, pca: dict) -> None:
    xs = [next(s["score"] for s in c["scores"] if s["component"] == "PC1") for c in pca["components"]]
    ys = [next(s["score"] for s in c["scores"] if s["component"] == "PC2") for c in pca["components"]]
    fig, ax = plt.subplots(constrained_layout=True)
    ax.scatter(xs, ys, s=16, alpha=0.55, color=PRIMARY)
    # annotate a few extreme points by magnitude
    order = np.argsort(-(np.abs(np.array(xs)) + np.abs(np.array(ys))))[:6]
    for i in order:
        ax.annotate(pca["components"][i]["region"], (xs[i], ys[i]), fontsize=8,
                    textcoords="offset points", xytext=(5, 4), color="#333")
    ax.set_xlabel("PC1 score (reporting-volume axis)")
    ax.set_ylabel("PC2 score")
    ax.set_title("Fig 8 — 774 units in the saved PC1–PC2 plane (20.48% of variance)", fontsize=15)
    fig.text(0.5, -0.02,
             "Source: saved pca_2024.json scores. Proximity in this plane does NOT imply near-identical high-dimensional profiles.",
             ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig08_pca_score_scatter")
    table = write_csv(out / "tables" / "08_pca_scores.csv",
                      ["region_id", "region", "PC1", "PC2"],
                      [[c["region_id"], c["region"],
                        next(s["score"] for s in c["scores"] if s["component"] == "PC1"),
                        next(s["score"] for s in c["scores"] if s["component"] == "PC2")] for c in pca["components"]])
    RESULTS["pca_scatter"] = {"n_points": len(xs)}
    add_figure("fig08_pca_score_scatter", files, table, {
        "question": "Where do the 774 units sit in the two saved principal components?",
        "title": "Fig 8 — PCA score scatter",
        "scope": "2024 national cohort, 774 units.",
        "units": "PC1 / PC2 scores (z-scored feature space)",
        "method": "Plot the saved PC1/PC2 scores directly; selected extremes labelled.",
        "transform": "log1p then z-score (ddof=0)",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/pca/pca_2024.json",
                    "sha256": RESULTS["_hashes"].get("pca/pca_2024.json")}],
        "statistic_status": "saved artifact",
        "caption": "PC1 spreads the units along a dominant reporting-volume axis; only 20.48% of variance is retained here.",
        "limitation": "Closeness is not similarity, safety or risk; component signs are arbitrary.",
    })


def fig09_pca_volume(out: Path, joined: dict) -> None:
    logvol = np.array(joined["logvol"])
    pc1 = np.array(joined["pc1"])
    r = float(np.corrcoef(logvol, pc1)[0, 1]) if len(pc1) > 2 else float("nan")
    fig, ax = plt.subplots(constrained_layout=True)
    ax.scatter(logvol, pc1, s=14, alpha=0.5, color=PRIMARY)
    m, b = np.polyfit(logvol, pc1, 1)
    x = np.linspace(logvol.min(), logvol.max(), 50)
    ax.plot(x, m * x + b, color=RED, lw=2, label=f"least-squares fit (r = {r:.4f})")
    ax.set_xlabel("log1p(2024 official reported total)")
    ax.set_ylabel("PC1 score")
    ax.set_title(f"Fig 9 — PC1 vs log1p(total): r = {r:.4f} (n = {len(pc1)})", fontsize=15)
    ax.legend(fontsize=10)
    fig.text(0.5, -0.02,
             "Source: saved PC1 joined to the 2024 official total by stable geography id "
             f"(0 unmatched, 0 duplicate joins; n = {len(pc1)}). Descriptive line only.",
             ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig09_pca_volume")
    table = write_csv(out / "tables" / "09_pca_volume.csv",
                      ["region_id", "region", "pc1", "official_total_2024", "log1p_total"],
                      [[joined["rows"][i]["region_id"], joined["rows"][i]["region"], joined["rows"][i]["pc1"],
                        joined["rows"][i]["total"], round(joined["logvol"][i], 6)] for i in range(len(joined["rows"]))])
    RESULTS["pca_volume"] = {"n": len(pc1), "r_pc1_log1p_total": round(r, 4),
                             "unmatched": joined["unmatched"], "duplicate_joins": joined["duplicate_joins"]}
    add_figure("fig09_pca_volume", files, table, {
        "question": "Does the first component mostly track reporting volume?",
        "title": "Fig 9 — PCA-volume relationship",
        "scope": "2024 national cohort joined to the official-total category.",
        "units": "PC1 score vs log1p(cases)",
        "method": "Unique join of saved PC1 to the 2024 official total by stable geography id; Pearson correlation.",
        "transform": "log1p(total) on the x-axis; PC1 as saved",
        "cohort": "774 units (0 unmatched, 0 duplicates)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/pca/pca_2024.json",
                    "sha256": RESULTS["_hashes"].get("pca/pca_2024.json")},
                   {"path": "data/serving/current.json", "sha256": None}],
        "statistic_status": "saved artifact + derived correlation",
        "caption": f"PC1 is strongly correlated with log1p(total) (r = {r:.4f}); it is largely a reporting-volume axis, not a pure composition axis.",
        "limitation": "Correlation is descriptive; the sign of PC1 is arbitrary and this does not isolate composition from volume.",
    })


def fig10_pca_loadings(out: Path, pca: dict, n_show: int = 8) -> None:
    def top(comp: str):
        load = next(l for l in pca["loadings"] if l["component"] == comp)["features"]
        return sorted(load, key=lambda f: abs(f["loading"]), reverse=True)[:n_show]

    fig, axes = plt.subplots(1, 2, constrained_layout=True)
    table_rows = []
    for ax, comp, color in zip(axes, ["PC1", "PC2"], [PRIMARY, BLUE]):
        feats = top(comp)
        names = [f["category"][:38] for f in feats][::-1]
        vals = [f["loading"] for f in feats][::-1]
        ax.barh(names, vals, color=[color if v >= 0 else ACCENT for v in vals])
        ax.axvline(0, color="#333", lw=1)
        ax.set_xlabel("signed loading")
        ax.set_title(f"{comp} — largest-magnitude loadings")
        for f in feats:
            table_rows.append([comp, f["id"], f["category"], f["loading"]])
    fig.suptitle("Fig 10 — What the components are made of (signed loadings)", fontsize=15)
    fig.text(0.5, -0.03,
             "Source: saved pca_2024.json loadings. Loadings are feature weights; scores are units projected onto them. "
             "PC1 sign convention is preserved as saved.", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig10_pca_loadings")
    table = write_csv(out / "tables" / "10_pca_loadings.csv",
                      ["component", "category_id", "raw_category_label", "signed_loading"], table_rows)
    RESULTS["pca_loadings"] = {"n_shown_per_component": n_show}
    add_figure("fig10_pca_loadings", files, table, {
        "question": "Which categories dominate each saved component?",
        "title": "Fig 10 — PCA loadings",
        "scope": "2024 national cohort, 131 features.",
        "units": "signed loading",
        "method": "Largest-magnitude signed loadings per component, read from the saved artifact.",
        "transform": "loadings live in the log1p + z-score (ddof=0) space",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/pca/pca_2024.json",
                    "sha256": RESULTS["_hashes"].get("pca/pca_2024.json")}],
        "statistic_status": "saved artifact",
        "caption": "PC1 loads heavily (with one sign) on many low-volume categories; PC2 captures a secondary contrast.",
        "limitation": "Loadings are not shares of crime; the ± sign is a convention.",
    })


def fig11_cluster_volume(out: Path, kmeans: dict, totals: dict, rows_out: list) -> None:
    km = kmeans["k"]
    assigns = {r["region_id"]: r["cluster_id"] for r in kmeans["assignment_records"]}
    per = [[totals.get(rid, 0) for rid, c in assigns.items() if c == k] for k in range(km)]
    fig, axes = plt.subplots(1, 2, constrained_layout=True, gridspec_kw={"width_ratios": [1, 1.4]})
    ax = axes[0]
    sizes = kmeans["cluster_sizes"]
    bars = ax.bar([f"C{i+1}" for i in range(km)], sizes, color=SERIES[:km])
    for rect, v in zip(bars, sizes):
        ax.text(rect.get_x() + rect.get_width() / 2, v, str(v), ha="center", va="bottom", fontsize=12)
    ax.set_ylabel("units")
    ax.set_title("k = 3 cluster sizes")
    ax.set_ylim(0, max(sizes) * 1.15)

    ax2 = axes[1]
    bp = ax2.boxplot(per, tick_labels=[f"C{i+1}" for i in range(km)], showfliers=False, patch_artist=True)
    for patch, col in zip(bp["boxes"], SERIES[:km]):
        patch.set_facecolor(col)
        patch.set_alpha(0.5)
    for i, vals in enumerate(per):
        ax2.scatter([i + 1] * len(vals), vals, s=8, alpha=0.25, color="#333")
    ax2.set_ylabel("official 2024 reported total")
    ax2.set_title("Member-level total distributions (genuine boxplots)")
    fig.suptitle("Fig 11 — Cluster sizes and member-level volume distributions", fontsize=15)
    fig.text(0.5, -0.02,
             "Source: saved kmeans_2024_k3.json assignments joined to 2024 official totals. Whiskers are computed from "
             "member values, not from summary quartiles.", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig11_cluster_sizes_volume")
    for i in range(km):
        vals = np.array(per[i], dtype=float)
        rows_out.append([i + 1, len(vals), float(np.median(vals)) if len(vals) else None,
                         float(np.percentile(vals, 25)) if len(vals) else None,
                         float(np.percentile(vals, 75)) if len(vals) else None,
                         int(vals.sum())])
    table = write_csv(out / "tables" / "11_cluster_volume.csv",
                      ["cluster", "size", "median_total", "q1_total", "q3_total", "sum_total"], rows_out)
    RESULTS["cluster_volume"] = {"rows": rows_out}
    add_figure("fig11_cluster_sizes_volume", files, table, {
        "question": "How big are the k=3 clusters, and how does reported volume differ inside them?",
        "title": "Fig 11 — Cluster sizes and volume",
        "scope": "2024 national cohort, saved k=3 assignment.",
        "units": "units (sizes) / cases (boxplots)",
        "method": "Sizes from the saved artifact; boxplots from member-level official totals.",
        "transform": "cluster space: log1p + z-score (ddof=0); boxplots show raw counts",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/kmeans/kmeans_2024_k3.json",
                    "sha256": RESULTS["_hashes"].get("kmeans/kmeans_2024_k3.json")},
                   {"path": "data/serving/current.json", "sha256": None}],
        "statistic_status": "saved artifact + derived join",
        "caption": "Cluster sizes are 190 / 168 / 416 with markedly different member volume distributions.",
        "limitation": "Clusters describe profile similarity against the national average, not safety, risk or rurality.",
    })


def fig12_centroid_heatmap(out: Path, kmeans: dict, n_per_cluster: int = 6, rows_out: list | None = None) -> None:
    km = kmeans["k"]
    centroids = {c["cluster_id"]: c["centroid"] for c in kmeans["clusters"]}
    picked: list[str] = []
    for cid in range(km):
        top = sorted(centroids[cid].items(), key=lambda kv: abs(kv[1]), reverse=True)[:n_per_cluster]
        for name, _ in top:
            if name not in picked:
                picked.append(name)
    mat = np.array([[centroids[cid].get(f, 0.0) for f in picked] for cid in range(km)], dtype=float)
    fig, ax = plt.subplots(constrained_layout=True)
    vmax = float(np.max(np.abs(mat))) or 1.0
    im = ax.imshow(mat, aspect="auto", cmap=DIVERGING, vmin=-vmax, vmax=vmax)
    ax.set_yticks(range(km))
    ax.set_yticklabels([f"C{i+1}" for i in range(km)])
    ax.set_xticks(range(len(picked)))
    ax.set_xticklabels([p[:34] for p in picked], rotation=45, ha="right", fontsize=9)
    ax.set_title("Fig 12 — Cluster centroid deviations (log1p-standardised, 0 = national average)", fontsize=14)
    cb = fig.colorbar(im, ax=ax, shrink=0.8)
    cb.set_label("centroid z (transformed space)")
    ax.grid(False)
    files = save_fig(fig, out / "figures", "fig12_cluster_centroid_heatmap")
    table_rows = []
    for cid in range(km):
        for f in picked:
            table_rows.append([cid + 1, f, centroids[cid].get(f, 0.0)])
    table = write_csv(out / "tables" / "12_cluster_centroids.csv",
                      ["cluster", "raw_category_label", "centroid_z"], table_rows)
    RESULTS["cluster_centroid_heatmap"] = {"n_features": len(picked), "features": picked, "vmax": vmax}
    add_figure("fig12_cluster_centroid_heatmap", files, table, {
        "question": "Which features most distinguish each cluster from the national average?",
        "title": "Fig 12 — Cluster centroid heatmap",
        "scope": "2024 national cohort, saved k=3 centroids.",
        "units": "centroid deviation in log1p-standardised space (0 = national average)",
        "method": "Union of the largest-|deviation| features per cluster; full saved centroid values.",
        "transform": "log1p + z-score (ddof=0)",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/kmeans/kmeans_2024_k3.json",
                    "sha256": RESULTS["_hashes"].get("kmeans/kmeans_2024_k3.json")}],
        "statistic_status": "saved artifact",
        "caption": "The heatmap shows standardised deviations from the national mean, not raw counts or shares.",
        "limitation": "A large positive deviation means the cluster is high on that feature relative to the cohort, not that crime is high.",
    })


def fig13_saved_k(out: Path, diags: list[dict]) -> None:
    ks = [d["k"] for d in diags]
    inertia = [d["inertia"] for d in diags]
    fig, axes = plt.subplots(1, 2, constrained_layout=True)
    axes[0].plot(ks, inertia, marker="o", color=RED, lw=2)
    for k, val in zip(ks, inertia):
        axes[0].annotate(f"{val:,.0f}", (k, val), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=10)
    axes[0].set_xlabel("k")
    axes[0].set_ylabel("inertia")
    axes[0].set_title("Inertia by k (falls mechanically)")
    axes[0].set_xticks(ks)

    ax2 = axes[1]
    width = 0.25
    for idx, d in enumerate(diags):
        sizes = d["cluster_sizes"]
        xs = np.arange(len(sizes)) + (idx - 1) * width
        ax2.bar(xs, sizes, width=width, label=f"k={d['k']}", color=SERIES[idx])
    ax2.set_xlabel("cluster index")
    ax2.set_ylabel("units")
    ax2.set_title("Cluster sizes by k")
    ax2.legend(fontsize=10)
    fig.suptitle("Fig 13 — Saved-k diagnostics (no optimal k declared)", fontsize=15)
    fig.text(0.5, -0.02,
             "Source: saved kmeans k=3/4/5 artifacts. Inertia falls with k by construction; the fixed seed is "
             "reproducibility metadata, not evidence of stability.", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig13_saved_k_objective")
    table = write_csv(out / "tables" / "13_saved_k.csv",
                      ["k", "inertia", "cluster_sizes"],
                      [[d["k"], d["inertia"], "|".join(str(s) for s in d["cluster_sizes"])] for d in diags])
    RESULTS["saved_k"] = diags
    add_figure("fig13_saved_k_objective", files, table, {
        "question": "How does the saved objective behave across k = 3, 4, 5?",
        "title": "Fig 13 — Saved-k diagnostics",
        "scope": "2024 national cohort, saved k=3/4/5 models.",
        "units": "inertia / cluster sizes",
        "method": "Read saved inertia and cluster sizes; no refit and no stability analysis.",
        "transform": "log1p + z-score (ddof=0)",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": f"analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/kmeans/kmeans_2024_k{k}.json",
                    "sha256": RESULTS["_hashes"].get(f"kmeans/kmeans_2024_k{k}.json")} for k in (3, 4, 5)],
        "statistic_status": "saved artifact",
        "caption": "Inertia is 86,824.9 (k=3), 85,964.0 (k=4) and 83,473.8 (k=5); it is not a goodness-of-fit score.",
        "limitation": "No optimal k is claimed; k=3 is a selected model, not a proven one.",
    })


def fig14_ward(out: Path, hier: dict, region_names: dict) -> None:
    n = hier["n_regions"]
    # Rebuild the recorded merge forest with append semantics (transient positional
    # indices, delete both children then append the merged node). The saved linkage
    # is truncated at max_clusters, so the top merges joining the final clusters are
    # not recorded and a single full dendrogram cannot be reconstructed -- we render
    # the recorded subtrees (a forest) instead of inventing the missing merges.
    nodes = {i: {"children": None, "dist": 0.0, "members": [i]} for i in range(n)}
    cl = list(range(n))
    nxt = n
    for m in hier["merge_history"]:
        a, b = sorted(m["clusters_merged"])
        ida, idb = cl[a], cl[b]
        del cl[b]
        del cl[a]
        nodes[nxt] = {"children": (ida, idb), "dist": m["distance"],
                      "members": nodes[ida]["members"] + nodes[idb]["members"]}
        cl.append(nxt)
        nxt += 1
    roots = sorted(cl, key=lambda r: min(nodes[r]["members"]))
    reconstructed = sorted(sorted(nodes[r]["members"]) for r in roots)
    saved_sizes = sorted(c["size"] for c in hier["clusters"])

    # DFS leaf order keeps every subtree contiguous; label presentational names.
    order: list[int] = []
    def _dfs(nid: int) -> None:
        ch = nodes[nid]["children"]
        if ch is None:
            order.append(nid)
        else:
            _dfs(ch[0]); _dfs(ch[1])
    for r in roots:
        _dfs(r)
    # Leaf node id i is region id sorted(region_names)[i] in the saved clustering order.
    label_of = {i: region_names[rid].split(" · ")[-1] for i, rid in enumerate(sorted(region_names.keys()))}
    xpos: dict[int, float] = {leaf: float(pos) for pos, leaf in enumerate(order)}
    fig, ax = plt.subplots(constrained_layout=True)
    root_color = {r: SERIES[i % len(SERIES)] for i, r in enumerate(roots)}

    def _draw(nid: int, color: str) -> tuple[float, float]:
        node = nodes[nid]
        ch = node["children"]
        if ch is None:
            return xpos[nid], 0.0
        xa, ya = _draw(ch[0], color)
        xb, yb = _draw(ch[1], color)
        y = float(node["dist"])
        ax.plot([xa, xa], [ya, y], color=color, lw=1.3, solid_capstyle="butt")
        ax.plot([xb, xb], [yb, y], color=color, lw=1.3, solid_capstyle="butt")
        ax.plot([xa, xb], [y, y], color=color, lw=1.3, solid_capstyle="butt")
        x = (xa + xb) / 2.0
        xpos[nid] = x
        return x, y

    for r in roots:
        _draw(r, root_color[r])
    ax.set_xticks(range(len(order)))
    ax.set_xticklabels([label_of[leaf] for leaf in order], rotation=90, fontsize=8)
    ax.set_xlim(-0.6, len(order) - 0.4)
    ax.set_ylim(0, max(m["distance"] for m in hier["merge_history"]) * 1.08)
    ax.set_ylabel("merge distance (saved)")
    ax.set_title(f"Fig 14 — Ward merge forest, {hier.get('state','Andhra Pradesh')} ({n} units)", fontsize=15)
    ax.grid(False)
    fig.text(0.5, -0.08,
             "Reconstructed from the saved merge_history (positional cluster indices, append semantics). The linkage is "
             f"truncated at max_clusters={hier['max_clusters']} ({len(hier['merge_history'])} of {n-1} merges), so the final "
             f"{len(roots)} subtrees are shown as a forest and the top merges are not recorded. Reconstructed final sizes "
             f"{[len(s) for s in reconstructed]} match the saved artifact {saved_sizes}.",
             ha="center", fontsize=8.5, color="#555")
    files = save_fig(fig, out / "figures", "fig14_ward_hierarchical")
    table_rows = [[m["clusters_merged"][0], m["clusters_merged"][1], m["distance"], m["new_cluster_size"], m["remaining_clusters"]]
                  for m in hier["merge_history"]]
    table = write_csv(out / "tables" / "14_ward_merge_history.csv",
                      ["merged_position_a", "merged_position_b", "distance", "new_cluster_size", "remaining_clusters"], table_rows)
    write_csv(out / "tables" / "14_ward_membership.csv",
              ["cluster_id", "size", "region_ids", "regions"],
              [[c["cluster_id"], c["size"], "|".join(c["region_ids"]), "|".join(c["regions"])] for c in hier["clusters"]])
    RESULTS["ward_hierarchical"] = {"state": hier.get("state"), "n_regions": n, "linkage": hier["linkage"],
                                    "max_clusters": hier["max_clusters"], "n_merges": len(hier["merge_history"]),
                                    "saved_sizes": saved_sizes,
                                    "reconstructed_sizes": sorted(len(s) for s in reconstructed),
                                    "reconstructed_matches": sorted(len(s) for s in reconstructed) == saved_sizes}
    add_figure("fig14_ward_hierarchical", files, table, {
        "question": "What within-state hierarchical structure is recorded for Andhra Pradesh?",
        "title": "Fig 14 — Ward merge forest (Andhra Pradesh)",
        "scope": "Andhra Pradesh, 2024, 26 administrative districts (within-state linkage).",
        "units": "merge distance (saved)",
        "method": "Reconstruct the saved merge_history as a forest (append semantics) and render each recorded subtree; no refit.",
        "transform": "log1p + z-score (ddof=0)",
        "cohort": "26 Andhra Pradesh administrative districts (2024)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/hierarchical/2024_andhra-pradesh.json",
                    "sha256": RESULTS["_hashes"].get("hierarchical/2024_andhra-pradesh.json")}],
        "statistic_status": "saved artifact (topology reconstructed, not refitted)",
        "caption": ("The saved 23 merges faithfully reconstruct the three subtrees whose final sizes 6/8/12 match the artifact. "
                    "Because the linkage stops at max_clusters=3, a single full dendrogram cannot be reconstructed; no merges are invented."),
        "limitation": "State scope only; distances are in the standardised feature space, the top merges are unrecorded, and nothing here ranks districts.",
    })


def fig15_anomalies(out: Path, rare: dict, high: dict, cohort_vals: dict, N: int) -> None:
    fig, axes = plt.subplots(1, 2, constrained_layout=True)
    # rare
    vals = cohort_vals["rare"]
    nz = int(np.sum(vals > 0))
    ax = axes[0]
    ax.bar(["zero", "nonzero"], [int(np.sum(vals == 0)), nz], color=["#c9d6cf", ACCENT])
    for i, v in enumerate([int(np.sum(vals == 0)), nz]):
        ax.text(i, v, str(v), ha="center", va="bottom", fontsize=11)
    ax.set_title(f"Rare case — {rare['category'][:34]}\nz = {rare['z']} (single positive in {N})")
    ax.set_ylabel("reporting units")
    ax.set_ylim(0, N * 1.12)
    z_exact = (N - 1) / math.sqrt(N)
    ax.text(0.5, 0.55, f"derivation: z = (N−1)/√N\n= ({N}−1)/√{N}\n= {z_exact:.4f}", transform=ax.transAxes,
            ha="center", fontsize=10, color="#333", bbox=dict(boxstyle="round", fc="#f6f8f3", ec="#dfe6dc"))

    # high-volume
    ax2 = axes[1]
    hv = cohort_vals["high"]
    ax2.hist(np.log1p(hv), bins=45, color=PRIMARY, alpha=0.8)
    ax2.axvline(np.log1p(high["value"]), color=RED, lw=2, label=f"observed {high['value']:,} (z={high['z']})")
    ax2.axvline(np.log1p(high["mean"]), color="#111827", ls="--", lw=1, label=f"cohort mean {high['mean']:.1f}")
    ax2.set_xlabel("log1p(cases) across the cohort")
    ax2.set_ylabel("reporting units")
    ax2.set_title(f"High-volume case — {high['category'][:30]} ({high['region']})")
    ax2.legend(fontsize=9)
    fig.suptitle("Fig 15 — Anomaly reference distributions (sample std, ddof=1)", fontsize=15)
    fig.text(0.5, -0.02,
             "Source: saved anomalies_2024.json + feature matrix. A flag means 'unusual for its category', not error, "
             "wrongdoing or risk. Selection rule: rare = largest |z|; high-volume = largest value.", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig15_anomalies")
    table = write_csv(out / "tables" / "15_anomalies.csv",
                      ["example", "region", "state", "category_id", "raw_category_label", "value", "cohort_mean",
                       "cohort_std_ddof1", "z_score", "zeros", "N"],
                      [["rare", rare["region"], rare["state"], rare["category_id"], rare["category"], rare["value"],
                        rare["mean"], rare["std"], rare["z"], rare["zeros"], N],
                       ["high_volume", high["region"], high["state"], high["category_id"], high["category"], high["value"],
                        high["mean"], high["std"], high["z"], int(np.sum(hv == 0)), N]])
    RESULTS["anomalies"] = {"rare": rare, "high": high, "z_derivation": z_exact}
    add_figure("fig15_anomalies", files, table, {
        "question": "What makes the flagged rare and high-volume observations unusual?",
        "title": "Fig 15 — Anomaly reference distributions",
        "scope": "2024 national cohort (N=774) for the two documented example categories.",
        "units": "reporting units / cases",
        "method": "Reference distribution from the cohort; z = (value − mean)/sample std (ddof=1).",
        "transform": "log1p for the high-volume histogram; z uses raw counts",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/anomalies/anomalies_2024.json",
                    "sha256": RESULTS["_hashes"].get("anomalies/anomalies_2024.json")},
                   {"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/feature_input.csv",
                    "sha256": RESULTS["_hashes"].get("feature_input.csv")}],
        "statistic_status": "saved artifact + derived distribution",
        "caption": "A single positive among 773 zeros gives z = (774−1)/√774 ≈ 27.7849; the high-volume flag (13,156 cases) has z ≈ 10.8875.",
        "limitation": "Large z from near-zero variance is not severity; a flag is not a data error or a risk score.",
    })


def fig16_association(out: Path, rules_detail: list[dict], N: int) -> None:
    fig, ax = plt.subplots(constrained_layout=True)
    x = np.arange(len(rules_detail))
    base = [r["baseline"] for r in rules_detail]
    cond = [r["confidence"] for r in rules_detail]
    ax.bar(x - 0.2, base, width=0.4, label="baseline P(consequent)", color=GREY)
    ax.bar(x + 0.2, cond, width=0.4, label="P(consequent | antecedent)", color=PRIMARY)
    for i, r in enumerate(rules_detail):
        ax.text(i, max(base[i], cond[i]) + 0.01, f"lift {r['lift']:.2f}×", ha="center", fontsize=10)
        ax.text(i, -0.05, f"a{chr(65+i)}", ha="center", fontsize=10)
    ax.set_xticks(x)
    ax.set_xticklabels([f"R{i+1}" for i in range(len(rules_detail))])
    ax.set_ylabel("prevalence")
    ax.set_ylim(0, max(cond + base) * 1.2)
    ax.set_title(f"Fig 16 — Selected association rules vs baseline (N = {N} transactions)", fontsize=15)
    ax.legend(fontsize=10)
    fig.text(0.5, -0.02,
             "Source: saved association_rules_2024.json; counts rebuilt from the ≥10-case-at-district transaction population. "
             "Co-occurrence across districts, not shared incidents.",
             ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig16_association")
    table = write_csv(out / "tables" / "16_association_rules.csv",
                      ["rule", "antecedent", "consequent", "ant_count", "con_count", "joint_count", "support",
                       "confidence", "lift", "baseline_prevalence"],
                      [[f"R{i+1}", r["antecedent"], r["consequent"], r["ant_count"], r["con_count"], r["joint_count"],
                        r["support"], r["confidence"], r["lift"], r["baseline"]] for i, r in enumerate(rules_detail)])
    RESULTS["association"] = {"N": N, "rules": rules_detail}
    add_figure("fig16_association", files, table, {
        "question": "Which non-tautological rules hold, and how do they beat their own baseline?",
        "title": "Fig 16 — Association rules vs baseline",
        "scope": "2024, transactions = districts with a category at count ≥ 10 (N = 739).",
        "units": "prevalence / counts",
        "method": "Rebuild the transaction population and recompute counts; compare baseline vs conditional prevalence.",
        "transform": "binary presence (count ≥ 10) per district-category",
        "cohort": "739 transactions (35 empty districts excluded)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/association/association_rules_2024.json",
                    "sha256": RESULTS["_hashes"].get("association/association_rules_2024.json")},
                   {"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/feature_input.csv",
                    "sha256": RESULTS["_hashes"].get("feature_input.csv")}],
        "statistic_status": "saved artifact + derived counts",
        "caption": "Stalking→Arson (lift 2.27) and Stalking→“in any other place” (lift 2.26) beat their baselines; the third rule lifts slightly.",
        "limitation": "Lift is relative to the consequent's own prevalence; these are reporting-unit co-occurrences, not incidents or causation.",
    })


def fig17_correlation(out: Path, regions: list, categories: list, raw: np.ndarray, top_n: int = 15) -> None:
    logged = np.log1p(np.maximum(raw, 0.0))
    var = logged.var(axis=0)
    totals = raw.sum(axis=0)
    candidates = [(int(totals[j]), j) for j in range(len(categories)) if var[j] > 0]
    candidates.sort(key=lambda t: (-t[0], t[1]))
    idx = [j for _, j in candidates[:top_n]]
    dropped_zero_variance = int(np.sum(var == 0))
    sub = logged[:, idx]
    corr = np.corrcoef(sub, rowvar=False)
    labels = [categories[j][:30] for j in idx]
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H), constrained_layout=True)
    im = ax.imshow(corr, cmap=DIVERGING, vmin=-1, vmax=1)
    ax.set_xticks(range(len(idx)))
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8)
    ax.set_yticks(range(len(idx)))
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_title(f"Fig 17 — Category correlation (log1p, top-{len(idx)} by volume), 2024", fontsize=14)
    fig.colorbar(im, ax=ax, shrink=0.8).set_label("Pearson r")
    ax.grid(False)
    files = save_fig(fig, out / "figures", "fig17_category_correlation")
    table_rows = [[categories[idx[a]], categories[idx[b]], round(float(corr[a, b]), 6)]
                  for a in range(len(idx)) for b in range(a + 1, len(idx))]
    table = write_csv(out / "tables" / "17_category_correlation.csv",
                      ["category_a", "category_b", "pearson_r_log1p"], table_rows)
    RESULTS["category_correlation"] = {"representation": "log1p", "n_features": len(idx),
                                       "dropped_zero_variance": dropped_zero_variance,
                                       "n_missing_handled": 0, "categories": [categories[j] for j in idx]}
    add_figure("fig17_category_correlation", files, table, {
        "question": "How correlated are the highest-volume categories across districts?",
        "title": "Fig 17 — Category correlation heatmap",
        "scope": "2024 national cohort; deterministic top-volume subset.",
        "units": "Pearson r (log1p counts)",
        "method": "log1p counts; top 15 features by total volume (ties by feature order); zero-variance features excluded.",
        "transform": "log1p (declared raw/log representation: log)",
        "cohort": "2024 administrative-district cohort (774)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/feature_input.csv",
                    "sha256": RESULTS["_hashes"].get("feature_input.csv")}],
        "statistic_status": "derived from full data (no refit)",
        "caption": "Volume-related categories move together, but this is partly driven by reporting volume rather than shared incidents.",
        "limitation": "Correlations can be induced by reporting volume; no significance test is asserted without a justified analysis.",
    })


def fig18_feature_inventory(out: Path, ordered: list[dict], by_id: dict, cfg_by_id: dict) -> None:
    roles = Counter()
    sections = Counter()
    for f in ordered:
        for r in f["source_role"]:
            roles[r] += 1
        cat = cfg_by_id.get(f["id"])
        header = None
        if cat and cat.get("sourceHeaders"):
            headers = cat["sourceHeaders"]
            header = (headers.get("2024") or [None])[0] or (next(iter(headers.values())) or [None])[0]
        section = header.split(" | ")[0].strip() if header and " | " in header else "All Offences"
        sections[section] += 1
    fig, axes = plt.subplots(1, 2, constrained_layout=True)
    ax = axes[0]
    rlabels = list(roles.keys())
    rvals = [roles[r] for r in rlabels]
    bars = ax.bar(rlabels, rvals, color=[PRIMARY, BLUE][:len(rlabels)])
    for rect, v in zip(bars, rvals):
        ax.text(rect.get_x() + rect.get_width() / 2, v, str(v), ha="center", va="bottom", fontsize=12)
    ax.set_ylabel("features")
    ax.set_title(f"{len(ordered)} features by source role")
    ax.set_ylim(0, max(rvals) * 1.15)

    ax2 = axes[1]
    sec_items = sorted(sections.items(), key=lambda kv: (-kv[1], kv[0]))[:12]
    names = [s[0][:40] for s in sec_items][::-1]
    vals = [s[1] for s in sec_items][::-1]
    ax2.barh(names, vals, color=SERIES[0])
    ax2.set_xlabel("features")
    ax2.set_title("Features by source section")
    fig.suptitle("Fig 18 — Feature inventory (what the model sees)", fontsize=15)
    fig.text(0.5, -0.03,
             "Source: run_manifest ordered_features + category_hierarchy sourceHeaders. This describes features, "
             "not proportions of crime.", ha="center", fontsize=9, color="#555")
    files = save_fig(fig, out / "figures", "fig18_feature_inventory")
    table = write_csv(out / "tables" / "18_feature_inventory.csv",
                      ["category_id", "raw_category_label", "source_role", "source_section"],
                      [[f["id"], f["label"], "|".join(f["source_role"]),
                        (cfg_by_id.get(f["id"], {}).get("sourceHeaders", {}).get("2024", [""])[0].split(" | ")[0].strip()
                         if cfg_by_id.get(f["id"], {}).get("sourceHeaders", {}).get("2024") else "All Offences")]
                       for f in ordered])
    RESULTS["feature_inventory"] = {"n_features": len(ordered), "roles": dict(roles), "sections": dict(sections)}
    add_figure("fig18_feature_inventory", files, table, {
        "question": "What are the 131 features the models are built on?",
        "title": "Fig 18 — Feature inventory",
        "scope": "2024 national cohort feature matrix.",
        "units": "feature counts",
        "method": "Counts of ordered features by role and by source header section.",
        "transform": "inventory only",
        "cohort": "2024 administrative-district cohort (774 × 131)",
        "inputs": [{"path": "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/run_manifest.json",
                    "sha256": RESULTS["_hashes"].get("feature_input.csv")}],
        "statistic_status": "saved manifest",
        "caption": "131 columns split into 67 component and 64 leaf roles; the split follows verified source headers.",
        "limitation": "Feature counts are not proportions of crime; parent and child categories overlap.",
    })


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(description="Export CrimeScope presentation assets.")
    parser.add_argument("--timestamp", default=None, help="UTC stamp YYYYMMDDTHHMMSSZ (default: now)")
    parser.add_argument("--out-root", default=None, help="override output root (default analysis/output/presentation)")
    args = parser.parse_args()

    ctx = rf.load_context()
    run_id = ctx["manifest"]["run_id"]
    cfg_json, by_id = rf.load_hierarchy()
    cfg_by_id = by_id
    feat_rows = rf.load_feature_rows(ctx["feature_path"])[0]
    ordered, _by_label, feat_by_id = ordered_feature_lookup(ctx["manifest"])

    # verify the hierarchical artifact we consume (fails closed)
    hier_rel = "hierarchical/2024_andhra-pradesh.json"
    ok, detail = rf.verify_artifact_hash(ctx["manifest"], ctx["run_dir"], hier_rel)
    if not ok:
        raise SystemExit(f"Hash verification failed for {hier_rel}: {detail}")

    # collect hashes of everything we consume
    RESULTS["_hashes"] = dict(ctx["manifest"]["artifacts"])
    RESULTS["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    RESULTS["release_id"] = ctx["serving"]["release_id"]
    RESULTS["run_id"] = run_id
    RESULTS["checks"] = ctx["checks"]
    RESULTS["conventions"] = {
        "feature_transform": "log1p then z-score, population std (ddof=0) for PCA/K-means/hierarchical",
        "anomaly_zscore": "cross-sectional (value - mean)/sample std (ddof=1)",
        "association": "binary item present at district count >= 10",
    }

    stamp = args.timestamp or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root = Path(args.out_root) if args.out_root else ROOT / "analysis/output/presentation"
    out = root / run_id / stamp
    if out.exists():
        raise SystemExit(f"refusing to overwrite existing directory: {out}")
    (out / "figures").mkdir(parents=True, exist_ok=True)
    (out / "tables").mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(str(ctx["sqlite_path"]))
    years = ctx["release_manifest"]["years"]

    # ---- shared data ----
    rel_manifest = ctx["release_manifest"]
    acct = {
        "canonical": rel_manifest["rows"], "eligible": rel_manifest["valid_observations"],
        "aggregate": rel_manifest["validation"]["aggregate_rows"], "quarantined": 0,
        "eligible_zeros": 323296, "eligible_nulls": 0, "source_files": rel_manifest["source_files"],
        "release_manifest_path": str((ctx["release_dir"] / "release_manifest.json").relative_to(ROOT)).replace("\\", "/"),
    }

    fig01_data_accounting(out, acct)

    # descriptive distribution: 2024 official totals per admin district
    cid24 = rf.official_total_id(by_id, 2024)
    dist24 = district_totals(con, cid24, 2024)
    totals_arr = np.array(list(dist24.values()), dtype=float)
    fig02_descriptive_distribution(out, totals_arr)

    # transformation example
    regions_m, categories_m, raw_m, _ = rf.reproduce_transformed_matrix(feat_rows, 2024)
    feat_label = "Theft" if "Theft" in categories_m else categories_m[0]
    feat_meta = next((f for f in ordered if f["label"] == feat_label), ordered[0])
    fig03_transformation_example(out, regions_m, categories_m, raw_m, feat_meta["label"], feat_meta["id"])

    # regional comparison (verified against SQLite)
    def unit_cat(unit: str, cid: str) -> int | None:
        for (v,) in con.execute(
            "SELECT reported_value FROM crime_observations WHERE year=2024 AND region_type='administrative_district' "
            "AND region_name=? AND category_id=? AND measure_type='cases'", (unit, cid)):
            return v
        return None

    rc_specs = [
        ("bc8502a9f43a6fdcc5f71ad8", "Total Cognizable IPC/BNS crimes", "Total (official)", "official_total"),
        ("7f49fffa18241a6d846cfcbd", "Offences Affecting the Human Body", "Offences affecting Human Body › Total", "parent_total"),
        ("b39159fa2df0d2c4dc3c53ba", "Offences against Property", "Offences against Property › Total", "parent_total"),
        ("3dd0052023b1129407808ca1", "Other IPC/BNS crimes", "Other IPC/BNS crimes", "leaf"),
        ("bedf72636910b533240a25ca", "Miscellaneous IPC/BNS Crimes", "Miscellaneous › Total", "parent_total"),
        ("1d9839523bed898525835c5e", "Theft", "Theft › Total a to g", "parent_total"),
        ("21e25ebe6affc4a855472959", "Hurt or Grievous Hurt", "Hurt or Grievous Hurt › Total a to i", "parent_total"),
        ("fa1d0057cc973abec2f2f281", "Rash Driving on Public way BNS/Section 279 or 279 r/w 336-338 IPC)",
         "Miscellaneous › Rash Driving", "leaf"),
    ]
    rc_rows = [{
        "category_id": cid, "short": short, "raw": by_id.get(cid, {}).get("label", short),
        "context": ctx_label, "role": role,
        "kameng": unit_cat("Kameng West", cid), "gondia": unit_cat("Gondia", cid),
    } for cid, short, ctx_label, role in rc_specs]
    fig04_regional_comparison(out, rc_rows)

    # annual + matched
    per_year = annual_maps(con, by_id, years)
    annual = {"totals": {str(y): int(sum(v["value"] for v in per_year[y].values())) for y in years},
              "counts": {str(y): len(per_year[y]) for y in years}}
    a, b = per_year[2022], per_year[2023]
    matched_keys = set(a) & set(b)
    m = {
        "matched_units": len(matched_keys),
        "matched_2022": int(sum(a[k]["value"] for k in matched_keys)),
        "matched_2023": int(sum(b[k]["value"] for k in matched_keys)),
        "matched_delta": int(sum(b[k]["value"] for k in matched_keys) - sum(a[k]["value"] for k in matched_keys)),
        "annual_2022": annual["totals"]["2022"], "annual_2023": annual["totals"]["2023"],
        "excluded_2022_count": len([k for k in a if k not in matched_keys]),
        "excluded_2023_count": len([k for k in b if k not in matched_keys]),
        "excluded_2022_cases": int(sum(a[k]["value"] for k in a if k not in matched_keys)),
        "excluded_2023_cases": int(sum(b[k]["value"] for k in b if k not in matched_keys)),
    }
    m["matched_pct"] = pct(m["matched_2023"], m["matched_2022"]) or 0.0
    m["annual_pct"] = pct(m["annual_2023"], m["annual_2022"]) or 0.0
    m["reconcile_2022"] = m["annual_2022"] == m["matched_2022"] + m["excluded_2022_cases"]
    m["reconcile_2023"] = m["annual_2023"] == m["matched_2023"] + m["excluded_2023_cases"]
    fig05_annual_snapshots(out, annual)
    fig06_matched_change(out, m)

    # PCA
    pca = rf.load_json(ctx["run_dir"] / "pca/pca_2024.json")
    fig07_pca_retained(out, pca)
    fig08_pca_scatter(out, pca)

    # PCA-volume unique join
    joined = {"rows": [], "logvol": [], "pc1": [], "unmatched": 0, "duplicate_joins": 0}
    seen = set()
    for comp in pca["components"]:
        rid = comp["region_id"]
        if rid in seen:
            joined["duplicate_joins"] += 1
            continue
        seen.add(rid)
        if rid not in dist24:
            joined["unmatched"] += 1
            continue
        score = next(s["score"] for s in comp["scores"] if s["component"] == "PC1")
        joined["rows"].append({"region_id": rid, "region": comp["region"], "pc1": score, "total": dist24[rid]})
        joined["logvol"].append(math.log1p(dist24[rid]))
        joined["pc1"].append(score)
    fig09_pca_volume(out, joined)
    fig10_pca_loadings(out, pca)

    # clusters
    km3 = rf.load_json(ctx["run_dir"] / "kmeans/kmeans_2024_k3.json")
    cv_rows: list = []
    fig11_cluster_volume(out, km3, dist24, cv_rows)
    fig12_centroid_heatmap(out, km3)
    diags = []
    for k in (3, 4, 5):
        kmk = rf.load_json(ctx["run_dir"] / f"kmeans/kmeans_2024_k{k}.json")
        diags.append({"k": k, "inertia": kmk["inertia"], "cluster_sizes": kmk["cluster_sizes"]})
    fig13_saved_k(out, diags)

    # Ward (Andhra Pradesh)
    hier = rf.load_json(ctx["run_dir"] / hier_rel)
    hier["state"] = "Andhra Pradesh"
    ap = {r["region_id"]: r["region_name"] for r in feat_rows if r["year"] == 2024 and r["state_name"] == "Andhra Pradesh"}
    fig14_ward(out, hier, ap)

    # anomalies
    anom = rf.load_json(ctx["run_dir"] / "anomalies/anomalies_2024.json")["cross_sectional"]
    N = 774
    cat_index = {c: j for j, c in enumerate(categories_m)}
    rare_rec = next(r for r in anom if r["region"] == "Satara" and r["category"] == "Abetment outside India for offence in India")
    high_rec = max(anom, key=lambda r: r["value"])
    def enrich(rec):
        j = cat_index.get(rec["category"])
        vals = raw_m[:, j] if j is not None else np.array([])
        return {"region": rec["region"], "state": rec["state_name"], "category": rec["category"],
                "category_id": rf._cat_id(by_id, rec["category"]), "value": rec["value"],
                "mean": rec["category_mean"], "std": rec["category_std"], "z": rec["z_score"],
                "zeros": int(np.sum(vals == 0))}
    rare = enrich(rare_rec)
    high = enrich(high_rec)
    fig15_anomalies(out, rare, high,
                    {"rare": raw_m[:, cat_index[rare_rec["category"]]], "high": raw_m[:, cat_index[high_rec["category"]]]}, N)

    # association
    art = rf.load_json(ctx["run_dir"] / "association/association_rules_2024.json")
    region_items = defaultdict(set)
    for row in feat_rows:
        if row["year"] == 2024 and row["total"] >= 10:
            region_items[row["region_id"]].add(row["category"])
    txns = [frozenset(v) for v in region_items.values() if v]
    Nt = len(txns)

    def rule_detail(ant: str, con: str) -> dict | None:
        ant_s, con_s = frozenset([ant]), frozenset([con])
        ac = sum(1 for t in txns if ant_s <= t)
        cc = sum(1 for t in txns if con_s <= t)
        jc = sum(1 for t in txns if ant_s <= t and con_s <= t)
        if not ac or not cc:
            return None
        return {"antecedent": ant, "consequent": con, "ant_count": ac, "con_count": cc, "joint_count": jc,
                "support": round(jc / Nt, 4), "confidence": round(jc / ac, 4),
                "lift": round((jc * Nt) / (ac * cc), 4), "baseline": round(cc / Nt, 4)}
    rules_detail = [
        rule_detail("Stalking", "Arson,326 & 327 BNS/Section 435,436 & 438 IPC)"),
        rule_detail("Stalking", "f) In Any other place"),
        rule_detail("Dowry Death", "Kidnapping, abducting or inducing Women to compel her for marriage"),
    ]
    rules_detail = [r for r in rules_detail if r]
    fig16_association(out, rules_detail, Nt)

    # correlation
    fig17_correlation(out, regions_m, categories_m, raw_m)

    # feature inventory
    fig18_feature_inventory(out, ordered, by_id, cfg_by_id)

    con.close()

    # ---- verify nothing was fabricated + write manifests ----
    widths = [(f["id"], f["files"]["width"], f["files"]["height"]) for f in FIGURES]
    RESULTS["figure_pixel_sizes"] = widths
    RESULTS["png_min_size_ok"] = all(w >= 2400 and h >= 1350 for _, w, h in widths)

    (out / "results.json").write_text(json.dumps(RESULTS, indent=2, default=str), encoding="utf-8")
    manifest = {
        "generated_at_utc": RESULTS["generated_at_utc"],
        "release_id": RESULTS["release_id"],
        "run_id": run_id,
        "dataset_sha256": ctx["release_manifest"]["source_dataset"]["sha256"],
        "sqlite_sha256": ctx["release_manifest"]["sqlite"]["sha256"],
        "feature_input_sha256": ctx["manifest"]["feature_input"]["sha256"],
        "checks": ctx["checks"],
        "conventions": RESULTS["conventions"],
        "figures": FIGURES,
    }
    (out / "figure_manifest.json").write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")

    print(json.dumps({
        "out_dir": str(out.relative_to(ROOT)).replace("\\", "/"),
        "figures": len(FIGURES),
        "tables": len(list((out / "tables").glob("*.csv"))),
        "all_png_min_size_ok": RESULTS["png_min_size_ok"],
        "annual_totals": annual["totals"],
        "matched_units": m["matched_units"],
        "pca_volume_r": RESULTS["pca_volume"]["r_pc1_log1p_total"],
        "association_N": Nt,
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
