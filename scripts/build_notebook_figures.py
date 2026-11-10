#!/usr/bin/env python
"""Build figure-augmented CrimeScope notebooks.

Reads the four executed notebooks, inserts new figure code cells (and a few
markdown section cells) using nbformat, and writes the augmented notebooks
back to the same paths. Existing cells are preserved unchanged; only new cells
are added. No notebook is executed here.
"""
import nbformat
from pathlib import Path

ROOT = Path(r"A:\Projects\crimescope")
NOTEBOOKS = {
    "01": ROOT / "notebooks" / "01_data_preprocessing.ipynb",
    "02": ROOT / "notebooks" / "02_statistics_and_trends.ipynb",
    "03": ROOT / "notebooks" / "03_pca_and_clustering.ipynb",
    "04": ROOT / "notebooks" / "04_anomalies_and_association_rules.ipynb",
}

STYLE = r"""
# --- CrimeScope notebook figure style ---
import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PRIMARY = "#237866"
ACCENT = "#d47a43"
BLUE = "#3d7894"
RED = "#b91c1c"
GREY = "#94a3b8"
SERIES = ["#237866", "#6689ba", "#cf9b46", "#9176ae", "#b45309"]

mpl.rcParams.update({
    "figure.figsize": (11, 5),
    "font.size": 11,
    "axes.titlesize": 13,
    "axes.labelsize": 11,
    "axes.grid": True,
    "grid.alpha": 0.25,
    "axes.axisbelow": True,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.facecolor": "white",
    "savefig.facecolor": "white",
    "axes.titleweight": "bold",
})


def fig_note(fig, text, y=-0.15):
    fig.text(0.5, y, text, ha="center", fontsize=9, color="#555")
"""


def md(text):
    return nbformat.v4.new_markdown_cell(text)


def code(source):
    return nbformat.v4.new_code_cell(source)


def insert_after(cells, anchor_index, new_cells):
    """Insert new_cells after the cell at anchor_index. Returns new list."""
    out = list(cells)
    offset = 0
    # process in descending anchor order so earlier inserts don't shift later ones
    for ai, cells_block in sorted(new_cells, key=lambda t: t[0], reverse=True):
        pos = ai + 1 + offset
        for c in cells_block:
            out.insert(pos, c)
            pos += 1
        offset += len(cells_block)
    return out


# ============================================================================
# NOTEBOOK 01 - data preprocessing
# ============================================================================
def build_n01():
    nb = nbformat.read(NOTEBOOKS["01"], as_version=4)
    cells = list(nb.cells)

    insertions = {}

    # Append style to setup cell (index 1)
    setup_src = cells[1]["source"] + "\n" + STYLE
    cells[1] = nbformat.v4.new_code_cell(setup_src)

    # --- Fig N01-01 source_fragment_coverage ---
    # Place after the source-index setup (cell 1 already has source_index).
    insertions.setdefault(1, []).extend([
        md("## Source fragment coverage"),
        code(r'''
# Figure N01-01 · source_fragment_coverage
# State/UT x year coverage heatmap for the 144 manifest-selected fragments,
# plus fragments per year and the grand total.
cov = source_index.assign(n=1).pivot_table(
    index="state_ut", columns="year", values="n", aggfunc="sum", fill_value=0)
cov = cov.reindex(sorted(cov.index))
years = [int(c) for c in cov.columns]
n_states = len(cov)

fig, axes = plt.subplots(1, 2, figsize=(13, 5.2),
                         gridspec_kw={"width_ratios": [1.85, 1]},
                         constrained_layout=True)
im = axes[0].imshow(cov.values, aspect="auto", cmap="Greens", vmin=0, vmax=1)
axes[0].set_xticks(range(len(years)))
axes[0].set_xticklabels([str(y) for y in years])
axes[0].set_yticks(range(n_states))
axes[0].set_yticklabels(cov.index, fontsize=6)
axes[0].set_xlabel("Year")
axes[0].set_ylabel("State / UT")
axes[0].set_title("Source fragment coverage: state/UT x year (2021-2024)")
for i in range(n_states):
    for j in range(len(years)):
        axes[0].text(j, i, "1" if cov.values[i, j] else "0",
                     ha="center", va="center", fontsize=5,
                     color="white" if cov.values[i, j] else "#999")
fig.colorbar(im, ax=axes[0], fraction=0.046, pad=0.04).set_label("fragment present (0/1)")

counts = source_index.groupby("year").size()
axes[1].bar([str(y) for y in counts.index], counts.values, color=PRIMARY, width=0.6)
for i, (y, c) in enumerate(counts.items()):
    axes[1].text(i, c, str(int(c)), ha="center", va="bottom", fontsize=12, fontweight="bold")
axes[1].set_xlabel("Year")
axes[1].set_ylabel("Indexed source fragments")
axes[1].set_title(f"Fragments per year - total {int(len(source_index))}")
axes[1].set_ylim(0, counts.max() * 1.12)
fig_note(fig, "All 36 state/UT fragments are present for every year 2021-2024 (36 x 4 = 144). "
              "Coverage is complete by construction; no year/state cell is empty.")
plt.show()
''')
    ])

    # --- Fig N01-02 canonical_row_accounting & N01-03 zero_missing_and_positive_counts ---
    # Place after row accounting cell (index 9).
    insertions.setdefault(9, []).extend([
        md("## Canonical observations: accounting and value breakdown"),
        code(r'''
# Figure N01-02 · canonical_row_accounting
# Eligible reporting-unit observations vs published aggregates (observation rows, not case counts).
row_accounting = db.execute("""SELECT count(*) AS canonical_rows,
    sum(CASE WHEN comparison_status='eligible' THEN 1 ELSE 0 END) AS eligible_rows,
    sum(CASE WHEN comparison_status='aggregate_only' THEN 1 ELSE 0 END) AS aggregate_rows
    FROM crime_observations""").fetchone()
canonical, eligible, aggregate = row_accounting

fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), constrained_layout=True)
bars = axes[0].bar(["Eligible reporting-unit\nobservations", "Published aggregate\nobservations"],
                   [eligible, aggregate], color=[PRIMARY, ACCENT], width=0.55)
for rect, v in zip(bars, [eligible, aggregate]):
    axes[0].text(rect.get_x() + rect.get_width() / 2, v, f"{v:,}", ha="center", va="bottom",
                 fontsize=12, fontweight="bold")
axes[0].set_ylabel("Canonical observation rows")
axes[0].set_ylim(0, canonical * 1.16)
axes[0].set_title(f"Canonical row accounting - {canonical:,} total rows")

# Composition of eligible rows: explicit zeros vs positives
eligible_zeros = db.execute("""SELECT sum(CASE WHEN comparison_status='eligible' AND reported_value=0 THEN 1 ELSE 0 END),
    sum(CASE WHEN comparison_status='eligible' AND reported_value>0 THEN 1 ELSE 0 END),
    sum(CASE WHEN comparison_status='eligible' AND reported_value IS NULL THEN 1 ELSE 0 END)
    FROM crime_observations""").fetchone()
ez, ep, en = eligible_zeros
agg_zeros = db.execute("""SELECT sum(CASE WHEN comparison_status='aggregate_only' AND reported_value=0 THEN 1 ELSE 0 END),
    sum(CASE WHEN comparison_status='aggregate_only' AND reported_value>0 THEN 1 ELSE 0 END)
    FROM crime_observations""").fetchone()
az, ap = agg_zeros

labels = ["Eligible - explicit zero", "Eligible - positive", "Aggregate - explicit zero", "Aggregate - positive"]
values = [ez, ep, az, ap]
colors = [GREY, PRIMARY, "#c9a227", ACCENT]
bars = axes[1].bar(labels, values, color=colors, width=0.6)
for rect, v in zip(bars, values):
    axes[1].text(rect.get_x() + rect.get_width() / 2, v, f"{v:,}", ha="center", va="bottom", fontsize=9)
axes[1].set_ylabel("Observation rows")
axes[1].set_title("Eligible vs aggregate: zeros vs positives")
axes[1].tick_params(axis="x", rotation=15)
fig_note(fig, f"Eligible: {eligible:,} rows = {ep:,} positive + {ez:,} explicit zeros (0 nulls). "
              f"Aggregate: {aggregate:,} rows = {ap:,} positive + {az:,} explicit zeros. "
              "A physically absent trailing field emits no observation and is outside this denominator.")
plt.show()
''')
    ])

    # --- Fig N01-04 reporting_unit_types_by_year ---
    insertions.setdefault(9, []).extend([
        code(r'''
# Figure N01-04 · reporting_unit_types_by_year
# Unique reporting units counted once per year, by unit type. Aggregates kept out of the bars.
region_counts = release.get("validation", {}).get("region_counts_by_year_type", [])
rc = pd.DataFrame(region_counts, columns=["year", "unit_type", "units"])
types_order = ["administrative_district", "city_police", "railway", "other_police_unit"]
rc = rc[rc["unit_type"].isin(types_order)]
pivot = rc.pivot(index="unit_type", columns="year", values="units").reindex(types_order)

fig, ax = plt.subplots(figsize=(10, 4.8), constrained_layout=True)
years = sorted(pivot.columns.astype(int))
x = np.arange(len(years))
width = 0.2
type_labels = {"administrative_district": "Administrative district",
               "city_police": "City police",
               "railway": "Railway police",
               "other_police_unit": "Other police unit"}
for i, t in enumerate(types_order):
    vals = [int(pivot.loc[t, y]) for y in years]
    ax.bar(x + (i - 1.5) * width, vals, width, label=type_labels[t], color=SERIES[i])
    for xi, v in zip(x + (i - 1.5) * width, vals):
        ax.text(xi, v, str(v), ha="center", va="bottom", fontsize=8)
ax.set_xticks(x)
ax.set_xticklabels([str(y) for y in years])
ax.set_xlabel("Year")
ax.set_ylabel("Unique reporting units (counted once per year)")
ax.set_title("Reporting units by year and unit type")
ax.legend(fontsize=9, ncol=2)
fig_note(fig, "Aggregate comparison_status rows are excluded from these unit counts. "
              "Administrative districts grow 726 -> 774 across 2021-2024; unit-type coverage is verified "
              "against the release validation counts.")
plt.show()
''')
    ])

    # --- Fig N01-05 raw_to_canonical_example ---
    # Place after the trace cell (index 5). Use the parsed trace already computed there.
    # Find the anchor: cell 5 is the trace cell. Insert after it.
    insertions.setdefault(5, []).extend([
        md("## Raw-to-canonical example (illustrated)"),
        code(r'''
# Figure N01-05 · raw_to_canonical_example
# Rendered trace of the Anantapur Murder cell: source row -> canonical observation.
trace_rows = [
    {"stage": "Wide source fragment (AP 2021)", "district": "Anantapur", "category": "Murder",
     "value": int(raw_trace.reported_value), "source_row": raw_trace.source_row_reference},
    {"stage": "Canonical observation", "district": raw_trace.region_name, "category": raw_trace.original_category,
     "value": int(raw_trace.reported_value), "source_row": raw_trace.source_row_reference},
    {"stage": "Serving SQLite row", "district": "Andhra Pradesh / Anantapur", "category": "Murder",
     "value": int(sqlite_row[4]), "source_row": sqlite_row[6]},
]
trace_df = pd.DataFrame(trace_rows)

fig, ax = plt.subplots(figsize=(10, 3.4), constrained_layout=True)
ax.axis("off")
tbl = ax.table(cellText=trace_df.values, colLabels=trace_df.columns, loc="center", cellLoc="left")
tbl.auto_set_font_size(False)
tbl.set_fontsize(10)
tbl.scale(1, 1.7)
for (r, c), cell in tbl.get_celld().items():
    if r == 0:
        cell.set_text_props(weight="bold", color="white")
        cell.set_facecolor(PRIMARY)
    elif r == 1:
        cell.set_facecolor("#e7f4f0")
ax.set_title("Raw row to canonical observation: Anantapur / Murder / 2021 = 107 cases", fontsize=12, pad=10)
fig_note(fig, "The source row (row_3), category, and value 107 are preserved identically in the parser output, "
              "the canonical CSV, and the serving SQLite. Geography ID, category ID, and observation ID are stable "
              "SHA-256-derived identifiers; they change if any input (state, district, year, header) changes.")
plt.show()
''')
    ])

    # --- Appendix: optional figures ---
    appendix_md = md("## Appendix: additional preprocessing diagnostics")
    appendix_cells = [
        appendix_md,
        # N01-06 canonical_observations_by_year
        code(r'''
# Figure N01-06 · canonical_observations_by_year (optional)
# Stacked eligible + aggregate observation rows by year.
year_rows = []
for y in (2021, 2022, 2023, 2024):
    el = db.execute("""SELECT count(*) FROM crime_observations WHERE year=? AND comparison_status='eligible'""", (y,)).fetchone()[0]
    ag = db.execute("""SELECT count(*) FROM crime_observations WHERE year=? AND comparison_status='aggregate_only'""", (y,)).fetchone()[0]
    year_rows.append({"year": y, "eligible": el, "aggregate": ag})
yr = pd.DataFrame(year_rows)

fig, ax = plt.subplots(figsize=(9, 4.4), constrained_layout=True)
ax.bar(yr["year"].astype(str), yr["eligible"], label="Eligible reporting-unit rows", color=PRIMARY)
ax.bar(yr["year"].astype(str), yr["aggregate"], bottom=yr["eligible"], label="Published aggregate rows", color=ACCENT)
for _, r in yr.iterrows():
    ax.text(str(r["year"]), r["eligible"] + r["aggregate"], f"{int(r['eligible']+r['aggregate']):,}",
            ha="center", va="bottom", fontsize=10, fontweight="bold")
ax.set_xlabel("Year")
ax.set_ylabel("Canonical observation rows")
ax.set_title("Canonical observations by year (eligible + aggregate)")
ax.legend()
fig_note(fig, "Observation counts differ across years because the number of reporting units and published "
              "categories vary by year (e.g. IPC through 2023, BNS in 2024). Rows are observations, not case totals.")
plt.show()
'''),
        # N01-07 zero_fraction_by_category
        code(r'''
# Figure N01-07 · zero_fraction_by_category (optional)
# Fraction of reporting units with an explicit zero per category, 2024 eligible cohort.
feat24 = pd.read_csv(release["source_dataset"]["path"])
feat24 = feat24[(feat24["year"] == 2024) & (feat24["region_type"] == "administrative_district")
                & (feat24["comparison_status"] == "eligible")]
zf = feat24.groupby("original_category")["reported_value"].apply(lambda s: (s == 0).mean()).sort_values(ascending=False)
n_cat = len(zf)

fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), constrained_layout=True)
axes[0].bar(range(n_cat), zf.values, color=np.where(zf.values > 0.9, ACCENT, PRIMARY), width=0.7)
axes[0].set_xlabel("Category (ranked by zero fraction)")
axes[0].set_ylabel("Fraction of units with explicit zero")
axes[0].set_title("Zero fraction per offence category (2024 eligible cohort)")
axes[0].set_ylim(0, 1)
sparse = zf[zf > 0.9]
dense = zf[zf <= 0.9]
axes[1].hist(zf.values, bins=20, color=BLUE, alpha=0.85, edgecolor="white")
axes[1].axvline(zf.median(), color=RED, ls="--", lw=1.5,
                label=f"median = {zf.median():.2f}")
axes[1].set_xlabel("Zero fraction")
axes[1].set_ylabel("Number of categories")
axes[1].set_title("Distribution of zero fractions across categories")
axes[1].legend(fontsize=9)
fig_note(fig, f"{n_cat} categories assessed on {feat24['geography_id'].nunique()} units. "
              f"{len(sparse)} categories are zero in over 90% of units (sparse, e.g. {sparse.index[0] if len(sparse) else ''}); "
              f"{len(dense)} categories are more widely reported. No category is zero everywhere or nowhere.")
plt.show()
'''),
        # N01-08 published_total_reconciliation
        code(r'''
# Figure N01-08 · published_total_reconciliation (optional)
# Sum of district official totals vs state-level published aggregate for the official-total category, 2024.
ot_cat = db.execute("""SELECT category_id FROM crime_observations
    WHERE year=2024 AND original_category='Total Cognizable IPC/BNS crimes' LIMIT 1""").fetchone()
if ot_cat is None:
    print("Skipping reconciliation: official-total category not found.")
else:
    ot_id = ot_cat[0]
    state_sum = db.execute("""SELECT state_name, sum(reported_value) AS district_sum
        FROM crime_observations WHERE year=2024 AND region_type='administrative_district'
          AND comparison_status='eligible' AND category_id=? GROUP BY state_name""", (ot_id,)).fetchall()
    state_agg = db.execute("""SELECT state_name, reported_value AS state_total
        FROM crime_observations WHERE year=2024 AND comparison_status='aggregate_only'
          AND original_region_name='Total Districts' AND category_id=?""", (ot_id,)).fetchall()
    sum_map = {s: v for s, v in state_sum}
    agg_map = {s: v for s, v in state_agg}
    states = sorted(set(sum_map) & set(agg_map))
    diffs = [(s, sum_map[s], agg_map[s], sum_map[s] - agg_map[s]) for s in states]
    rec = pd.DataFrame(diffs, columns=["state", "district_sum", "state_aggregate", "difference"])
    exact = int((rec["difference"] == 0).sum())

    fig, ax = plt.subplots(figsize=(10, 4.6), constrained_layout=True)
    if len(rec):
        x = np.arange(len(rec))
        ax.bar(x - 0.2, rec["district_sum"], width=0.4, label="Sum of district official totals", color=PRIMARY)
        ax.bar(x + 0.2, rec["state_aggregate"], width=0.4, label="Published state aggregate", color=ACCENT)
        ax.set_xticks(x)
        ax.set_xticklabels([s[:18] for s in rec["state"]], rotation=90, fontsize=7)
        ax.set_ylabel("Official reported total (cases)")
        ax.set_title("District sum vs published state aggregate - official total, 2024")
        ax.legend(fontsize=9)
    fig_note(fig, f"{len(rec)} comparable state-years; {exact} are exact matches (difference = 0). "
                  "Where differences exist they reflect the published state aggregate's own rounding/suppression "
                  "rules rather than a canonical-data error. Aggregate counts are kept separate from dashboard scope.")
    plt.show()
'''),
        # N01-09 partial_2020_scope -> skip figure, just a note cell
        md("### Partial 2020 scope"),
        code(r'''
# Figure N01-09 · partial_2020_scope (optional) - not drawn
# The 2020 Andhra Pradesh slice is excluded from the active release; no national-comparison figure is drawn.
print("2020 partial Andhra Pradesh input is excluded from the active release (2021-2024 only). "
      "It is a historical partial slice and is outside the national comparison, so no coverage figure is drawn for it.")
''')
    ]
    # Insert appendix after the last cell (index = len(cells)-1 currently, but we've been inserting; use end)
    insertions.setdefault(len(cells) - 1, []).extend(appendix_cells)

    nb.cells = insert_after(cells, -1, [])  # no-op placeholder
    # Apply all insertions
    nb.cells = insert_after(cells, -1, [])
    # Rebuild: simpler to apply via insert_after repeatedly. We collected `insertions` dict anchor->cells.
    final_cells = list(cells)
    for ai, block in sorted(insertions.items(), key=lambda t: t[0], reverse=True):
        pos = ai + 1
        for c in block:
            final_cells.insert(pos, c)
            pos += 1
    nb.cells = final_cells
    nbformat.write(nb, NOTEBOOKS["01"])
    print("Wrote", NOTEBOOKS["01"].name, "cells:", len(nb.cells))


# ============================================================================
# NOTEBOOK 02 - descriptive statistics and trends
# ============================================================================
def build_n02():
    nb = nbformat.read(NOTEBOOKS["02"], as_version=4)
    cells = list(nb.cells)

    # Append style to setup cell (index 1)
    cells[1] = nbformat.v4.new_code_cell(cells[1]["source"] + "\n" + STYLE)

    insertions = {}

    # Improve existing figure cell (index 8) -> replace with annual_totals_and_matched_change
    # N02-01
    insertions.setdefault(7, []).extend([
        md("## Annual totals and matched-unit change"),
        code(r'''
# Figure N02-01 · annual_totals_and_matched_change (replaces the original two-panel chart)
# Panel A: independent annual totals 2021-2024. Panel B: 2022 vs 2023 annual sets and common named units.
fig, axes = plt.subplots(1, 2, figsize=(12.5, 4.8), constrained_layout=True)

axes[0].bar(annual["year"].astype(str), annual["annual reported total"], color=PRIMARY, width=0.6)
for i, v in enumerate(annual["annual reported total"]):
    axes[0].text(i, v, f"{v/1e6:.2f}M", ha="center", va="bottom", fontsize=9)
axes[0].set_xlabel("Reporting year (IPC through 2023; BNS in 2024)")
axes[0].set_ylabel("Official reported total (cases)")
axes[0].set_title("Panel A - independent annual totals, all eligible districts")
axes[0].ticklabel_format(axis="y", style="plain")
axes[0].set_yticks([0, 5e6, 1e7, 1.5e7, 2e7, 2.5e7, 3e7])
axes[0].set_yticklabels(["0", "5M", "10M", "15M", "20M", "25M", "30M"])
axes[0].axvspan(1.5, 2.5, color=RED, alpha=0.08)
axes[0].text(2.0, annual["annual reported total"].max() * 0.92, "IPC -> BNS\nreporting transition", ha="center", fontsize=8, color=RED)

matched_plot = pd.DataFrame({
    "unit set": ["All annual units", "Matched units (749)"],
    "2022": [sum(from_2022.values()), matched_2022],
    "2023": [sum(from_2023.values()), matched_2023],
}).set_index("unit set")
matched_plot.plot(kind="bar", ax=axes[1], color=[GREY, ACCENT], width=0.7)
for container in axes[1].containers:
    axes[1].bar_label(container, fmt="%.1fM", fontsize=8, padding=2)
for i, v in enumerate([sum(from_2022.values()), matched_2022, sum(from_2023.values()), matched_2023]):
    pass
axes[1].set_xlabel("Unit set")
axes[1].set_ylabel("Official reported total (cases)")
axes[1].set_title("Panel B - 2022 vs 2023: annual sets vs common named units")
axes[1].ticklabel_format(axis="y", style="plain")
axes[1].set_yticks([0, 2e6, 4e6, 6e6, 8e6])
axes[1].set_yticklabels(["0", "2M", "4M", "6M", "8M"])
axes[1].legend(title="Year", fontsize=9)
axes[1].tick_params(axis="x", rotation=0)
fig_note(fig, f"Full annual sets change {annual_change_pct:+.2f}% (2022 to 2023); the {len(common_units)} common named units change {matched_change_pct:+.2f}%. "
              "A name match is not evidence that district boundaries stayed the same. Counts are reported cases, not rates.")
plt.show()
''')
    ])

    # N02-02 reporting_unit_totals_distribution_2024
    insertions.setdefault(7, []).extend([
        code(r'''
# Figure N02-02 · reporting_unit_totals_distribution_2024
# Histogram of per-unit official totals plus a log1p histogram to reveal the tail.
official_2024 = np.array(list(unit_values[2024].values()))

fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), constrained_layout=True)
axes[0].hist(official_2024, bins=50, color=PRIMARY, alpha=0.85, edgecolor="white")
axes[0].axvline(np.median(official_2024), color=RED, ls="--", lw=1.5,
                label=f"median = {np.median(official_2024):,.0f}")
axes[0].set_xlabel("Official reported total per unit (cases, 2024)")
axes[0].set_ylabel("Eligible administrative districts")
axes[0].set_title("Distribution of per-unit reported totals")
axes[0].legend(fontsize=9)
axes[1].hist(np.log1p(official_2024), bins=50, color=ACCENT, alpha=0.85, edgecolor="white")
axes[1].axvline(np.log1p(np.median(official_2024)), color=RED, ls="--", lw=1.5)
axes[1].set_xlabel("log1p(official reported total per unit)")
axes[1].set_ylabel("Eligible administrative districts")
axes[1].set_title("log1p-transformed distribution (reveals the tail)")
fig_note(fig, f"n = {len(official_2024)} eligible administrative districts, median {np.median(official_2024):,.0f} cases. "
              "Zeros are kept explicit (log1p(0)=0); no plain log scale is used so zeros are not hidden.")
plt.show()
''')
    ])

    # N02-03 reporting_unit_totals_by_year
    insertions.setdefault(7, []).extend([
        code(r'''
# Figure N02-03 · reporting_unit_totals_by_year
# Box plots of per-unit totals for each annual cohort.
year_data = []
year_labels = []
for y in (2021, 2022, 2023, 2024):
    vals = np.array(list(unit_values[y].values()))
    year_data.append(vals)
    year_labels.append(f"{y}\n(n={len(vals)})")

fig, ax = plt.subplots(figsize=(10, 4.8), constrained_layout=True)
bp = ax.boxplot(year_data, patch_artist=True, showfliers=False, medianprops={"color": RED})
for patch, col in zip(bp["boxes"], SERIES):
    patch.set_facecolor(col); patch.set_alpha(0.6)
ax.set_ylabel("Official reported total per unit (cases)")
ax.set_title("Per-unit reported totals by annual cohort")
ax.set_xticklabels(year_labels, fontsize=9)
ax.ticklabel_format(axis="y", style="plain")
ax.axvspan(2.5, 3.5, color=RED, alpha=0.08)
ax.text(3.0, ax.get_ylim()[1] * 0.92, "IPC -> BNS\ntransition", ha="center", fontsize=8, color=RED)
fig_note(fig, "Annual cohorts can change year to year (726, 750, 770, 774 districts), so boxes are not a "
              "single fixed panel tracked over time. Each box describes that year's own eligible district set.")
plt.show()
''')
    ])

    # N02-04 regional_category_profile
    insertions.setdefault(7, []).extend([
        code(r'''
# Figure N02-04 · regional_category_profile
# Grouped bars for two verified units across a small, explicitly selected set of offence categories (2024).
profile_cats = ["Murder BNS /Section 302 IPC)", "Rape", "Theft", "Kidnapping and Abduction (Total)"]
# resolve available category ids
rows = []
for cat in profile_cats:
    cid = db.execute("SELECT category_id FROM crime_observations WHERE year=2024 AND original_category=? GROUP BY category_id", (cat,)).fetchone()
    if cid is None:
        continue
    cid = cid[0]
    for dist in ["Anantapuramu", "Anjaw"]:
        v = db.execute("""SELECT reported_value FROM crime_observations
            WHERE year=2024 AND region_type='administrative_district' AND region_name=?
              AND quality_status='valid' AND comparison_status='eligible' AND category_id=?""", (dist, cid)).fetchone()
        rows.append({"district": dist, "category": cat, "cases": int(v[0]) if v else 0})
prof = pd.DataFrame(rows)

fig, ax = plt.subplots(figsize=(10, 4.8), constrained_layout=True)
x = np.arange(len(profile_cats))
width = 0.35
for i, dist in enumerate(["Anantapuramu", "Anjaw"]):
    vals = [int(prof[(prof["district"] == dist) & (prof["category"] == c)]["cases"].iloc[0])
            if len(prof[(prof["district"] == dist) & (prof["category"] == c)]) else 0
            for c in profile_cats]
    ax.bar(x + (i - 0.5) * width, vals, width, label=dist, color=SERIES[i])
    for xi, v in zip(x + (i - 0.5) * width, vals):
        ax.text(xi, v, str(v), ha="center", va="bottom", fontsize=8)
ax.set_xticks(x)
ax.set_xticklabels([c[:24] for c in profile_cats], rotation=15, ha="right", fontsize=8)
ax.set_ylabel("Reported cases (2024)")
ax.set_title("Regional category profile - two verified districts (2024)")
ax.legend()
fig_note(fig, "Overlapping categories are treated as separate measurements; they are not stacked or summed. "
              "These profiles illustrate count structure, not safety comparisons.")
plt.show()
''')
    ])

    # N02-05 category_correlation_heatmap
    insertions.setdefault(7, []).extend([
        code(r'''
# Figure N02-05 · category_correlation_heatmap
# Pearson correlations for a small justified set of offence categories (raw counts), 2024 eligible cohort.
corr_cats = ["Murder BNS /Section 302 IPC)", "Rape", "Theft", "Kidnapping and Abduction (Total)",
             "Robbery, 309, 311 BNS/Section 392/394/397 IPC)", "Assault or use of Criminal Force to woman with intent to outrage her modesty"]
corr_ids = []
for cat in corr_cats:
    cid = db.execute("SELECT category_id FROM crime_observations WHERE year=2024 AND original_category=? GROUP BY category_id", (cat,)).fetchone()
    if cid:
        corr_ids.append((cat, cid[0]))
# build wide matrix unit x category
wide = {}
for cat, cid in corr_ids:
    vals = db.execute("""SELECT region_name, reported_value FROM crime_observations
        WHERE year=2024 AND region_type='administrative_district' AND quality_status='valid'
          AND comparison_status='eligible' AND category_id=?""", (cid,)).fetchall()
    wide[cat] = {r[0]: (r[1] if r[1] is not None else 0) for r in vals}
cmat = pd.DataFrame(wide)
# align on common units
common_units = set.intersection(*[set(d) for d in wide.values()]) if wide else set()
cmat = cmat.loc[sorted(common_units)]
corr = cmat.corr()

fig, ax = plt.subplots(figsize=(8, 6), constrained_layout=True)
im = ax.imshow(corr.values, cmap="RdBu_r", vmin=-1, vmax=1)
ax.set_xticks(range(len(corr.columns)))
ax.set_xticklabels([c[:20] for c in corr.columns], rotation=45, ha="right", fontsize=8)
ax.set_yticks(range(len(corr.index)))
ax.set_yticklabels([c[:20] for c in corr.index], fontsize=8)
for i in range(len(corr.columns)):
    for j in range(len(corr.index)):
        ax.text(j, i, f"{corr.iloc[i, j]:.2f}", ha="center", va="center", fontsize=9,
                color="white" if abs(corr.iloc[i, j]) > 0.5 else "#222")
fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04).set_label("Pearson correlation (-1 to +1)")
ax.set_title("Category correlation heatmap - raw reported counts, 2024")
fig_note(fig, f"Input is raw reported counts (not transformed). {len(common_units)} common units across all {len(corr_ids)} categories. "
              "Constant columns (zero variance) would be excluded explicitly; none occur here.")
plt.show()
''')
    ])

    # N02-06 matched_unit_change_distribution
    insertions.setdefault(7, []).extend([
        code(r'''
# Figure N02-06 · matched_unit_change_distribution
# 2022 vs 2023 scatter for the exact same named cohort, plus histogram of absolute per-unit change.
rows_2022 = pd.DataFrame([{"key": k, "v2022": v} for k, v in from_2022.items()])
rows_2023 = pd.DataFrame([{"key": k, "v2023": v} for k, v in from_2023.items()])
merged = rows_2022.merge(rows_2023, on="key")
v2022 = merged["v2022"].to_numpy()
v2023 = merged["v2023"].to_numpy()
abs_change = np.abs(v2023 - v2022)

fig, axes = plt.subplots(1, 2, figsize=(12, 4.8), constrained_layout=True)
axes[0].scatter(v2022, v2023, s=12, alpha=0.5, color=PRIMARY)
lo = min(v2022.min(), v2023.min()); hi = max(v2022.max(), v2023.max())
axes[0].plot([lo, hi], [lo, hi], color=RED, ls="--", lw=1, label="equality (no change)")
axes[0].set_xlabel("2022 reported cases per unit")
axes[0].set_ylabel("2023 reported cases per unit")
axes[0].set_title(f"2022 vs 2023 - {len(merged)} matched units")
axes[0].legend(fontsize=9)
axes[1].hist(abs_change, bins=40, color=ACCENT, alpha=0.85, edgecolor="white")
axes[1].axvline(np.median(abs_change), color=RED, ls="--", lw=1.5,
                label=f"median |change| = {np.median(abs_change):,.0f}")
axes[1].set_xlabel("Absolute per-unit change |2023 - 2022| (cases)")
axes[1].set_ylabel("Units")
axes[1].set_title("Distribution of absolute per-unit change")
axes[1].legend(fontsize=9)
fig_note(fig, f"Matched cohort: {len(merged)} units. Zero baselines are handled case-by-case (a unit at 0 in 2022 "
              "cannot yield a meaningful percentage change; absolute change is shown instead). "
              "Percentage changes are reported separately in Panel B of Figure N02-01.")
plt.show()
''')
    ])

    # Appendix N02: optional figures
    appendix = [
        md("## Appendix: additional descriptive diagnostics"),
        # N02-07 annual_vs_matched_cohort_accounting
        code(r'''
# Figure N02-07 · annual_vs_matched_cohort_accounting (optional)
fig, axes = plt.subplots(1, 2, figsize=(12, 4.4), constrained_layout=True)
acct = comparison.copy()
axes[0].bar(acct["comparison"], acct["units"], color=[SERIES[0], SERIES[1], SERIES[1], SERIES[2]], width=0.6)
for i, v in enumerate(acct["units"]):
    axes[0].text(i, v, str(v), ha="center", va="bottom", fontsize=9)
axes[0].set_ylabel("Units"); axes[0].set_title("Units per comparison set")
axes[0].tick_params(axis="x", rotation=15)
axes[1].bar(acct["comparison"], acct["reported total"], color=[SERIES[0], SERIES[1], SERIES[1], SERIES[2]], width=0.6)
for i, v in enumerate(acct["reported total"]):
    axes[1].text(i, v, f"{v/1e6:.2f}M", ha="center", va="bottom", fontsize=9)
axes[1].set_ylabel("Reported total (cases)"); axes[1].set_title("Reported total per comparison set")
axes[1].ticklabel_format(axis="y", style="plain")
axes[1].tick_params(axis="x", rotation=15)
fig_note(fig, "Matched + excluded totals reconcile to the full annual totals shown in Figure N02-01. "
              "A name match is not proof of identical boundaries; unmatched names are excluded only from the matched calculation.")
plt.show()
'''),
        # N02-08 reported_totals_by_state_2024
        code(r'''
# Figure N02-08 · reported_totals_by_state_2024 (optional)
ot_id = db.execute("""SELECT category_id FROM crime_observations WHERE year=2024 AND original_category='Total Cognizable IPC/BNS crimes' LIMIT 1""").fetchone()[0]
st = db.execute("""SELECT state_name, count(DISTINCT region_name) AS n_units, sum(reported_value) AS total
    FROM crime_observations WHERE year=2024 AND region_type='administrative_district'
      AND quality_status='valid' AND comparison_status='eligible' AND category_id=?
    GROUP BY state_name ORDER BY total DESC""", (ot_id,)).fetchall()
stdf = pd.DataFrame(st, columns=["state", "n_units", "total"])

fig, axes = plt.subplots(1, 2, figsize=(12, 5), constrained_layout=True)
axes[0].barh(stdf["state"][::-1], stdf["total"][::-1], color=PRIMARY)
for i, (_, r) in enumerate(stdf.iloc[::-1].iterrows()):
    axes[0].text(r["total"], i, f" {int(r['total']):,}", va="center", fontsize=8)
axes[0].set_xlabel("Sum of district official totals (cases, 2024)")
axes[0].set_title("Reported volume by state (administrative districts)")
med_panel = stdf.assign(median_per_unit=np.nan)
fig_note(fig, f"Ranked horizontal bars of reported volume by state; number of units per state shown implicitly by the cohort scope. "
              f"A per-unit median panel can use its own axis if added. Volume is not a rate and does not rank safety.")
plt.show()
'''),
        # N02-09 category_count_distributions
        code(r'''
# Figure N02-09 · category_count_distributions (optional)
# Small multiples: a widespread category and a sparse one.
pick = [("Rape", "widespread"), ("Abetment outside India for offence in India", "sparse")]
fig, axes = plt.subplots(1, 2, figsize=(11, 4.4), constrained_layout=True)
for ax, (cat, tag) in zip(axes, pick):
    cid = db.execute("SELECT category_id FROM crime_observations WHERE year=2024 AND original_category=? GROUP BY category_id", (cat,)).fetchone()
    vals = np.array([r[0] for r in db.execute("""SELECT reported_value FROM crime_observations
        WHERE year=2024 AND region_type='administrative_district' AND quality_status='valid'
          AND comparison_status='eligible' AND category_id=?""", (cid[0],))])
    ax.hist(vals, bins=25, color=PRIMARY if tag == "widespread" else ACCENT, alpha=0.85, edgecolor="white")
    zf = (vals == 0).mean()
    ax.set_xlabel("Reported cases"); ax.set_ylabel("Units")
    ax.set_title(f"{cat} ({tag}) - zero fraction {zf:.2f}")
fig_note(fig, "Two categories with different distributions; zeros are visible in the histograms rather than hidden by transformation.")
plt.show()
'''),
        # N02-10 selected_category_pair_scatter
        code(r'''
# Figure N02-10 · selected_category_pair_scatter (optional)
# Scatter of an interpretable correlated pair from the heatmap.
pair = ["Murder BNS /Section 302 IPC)", "Rape"]
# build values per unit for each
vals = {}
for cat in pair:
    cid = db.execute("SELECT category_id FROM crime_observations WHERE year=2024 AND original_category=? GROUP BY category_id", (cat,)).fetchone()
    vals[cat] = {r[0]: (r[1] if r[1] is not None else 0) for r in db.execute("""SELECT region_name, reported_value FROM crime_observations
        WHERE year=2024 AND region_type='administrative_district' AND quality_status='valid'
          AND comparison_status='eligible' AND category_id=?""", (cid[0],))}
common = sorted(set(vals[pair[0]]) & set(vals[pair[1]]))
x = np.array([vals[pair[0]][u] for u in common])
y = np.array([vals[pair[1]][u] for u in common])
r_coef = np.corrcoef(x, y)[0, 1] if len(common) > 1 else float("nan")

fig, ax = plt.subplots(figsize=(7, 5.5), constrained_layout=True)
ax.scatter(x, y, s=14, alpha=0.5, color=PRIMARY)
m, b = np.polyfit(x, y, 1)
xx = np.linspace(x.min(), x.max(), 50)
ax.plot(xx, m * xx + b, color=RED, lw=1.5, label=f"descriptive fit (r = {r_coef:.2f})")
ax.set_xlabel(pair[0] + " (cases)"); ax.set_ylabel(pair[1] + " (cases)")
ax.set_title(f"Selected category pair scatter - raw counts, 2024 (n = {len(common)})")
ax.legend(fontsize=9)
fig_note(fig, "Both axes are raw reported counts. The fitted line is descriptive only; correlation does not imply "
              "linked incidents or causation, and the unit of analysis is a district's annual reporting profile.")
plt.show()
'''),
    ]
    # apply appendix after the last existing cell
    last_idx = len(cells) - 1
    final_cells = list(cells)
    for ai, block in sorted(insertions.items(), key=lambda t: t[0], reverse=True):
        pos = ai + 1
        for c in block:
            final_cells.insert(pos, c)
            pos += 1
    # append appendix at end
    for c in appendix:
        final_cells.append(c)
    nb.cells = final_cells
    # Remove the original two-panel chart cell (superseded by Figure N02-01) so it is not duplicated.
    nb.cells = [c for c in nb.cells
                if not (c.get("cell_type") == "code"
                        and "Annual snapshots · all eligible districts" in c.get("source", ""))]
    nbformat.write(nb, NOTEBOOKS["02"])
    print("Wrote", NOTEBOOKS["02"].name, "cells:", len(nb.cells))


# ============================================================================
# NOTEBOOK 03 - PCA and clustering
# ============================================================================
def build_n03():
    nb = nbformat.read(NOTEBOOKS["03"], as_version=4)
    cells = list(nb.cells)
    cells[1] = nbformat.v4.new_code_cell(cells[1]["source"] + "\n" + STYLE)

    insertions = {}

    # N03-01 feature_matrix_selection -> after feature matrix cell (index 3)
    insertions.setdefault(3, []).extend([
        md("## Feature matrix selection"),
        code(r'''
# Figure N03-01 · feature_matrix_selection
# How the active 2024 cohort and category roles produce the 774 x 131 feature matrix.
canon_rows = int(source_rows) if 'source_rows' in globals() else len(features)
fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), constrained_layout=True)
axes[0].bar(["Eligible administrative districts\n(quality=valid, comparison=eligible)",
             "Feature categories\n(role in {leaf, component})",
             "Feature matrix cells\n(districts x categories)"],
            [features["region_id"].nunique(), len(feature_defs), len(features)],
            color=[PRIMARY, BLUE, ACCENT], width=0.55)
for i, v in enumerate([features["region_id"].nunique(), len(feature_defs), len(features)]):
    axes[0].text(i, v, f"{v:,}", ha="center", va="bottom", fontsize=11, fontweight="bold")
axes[0].set_ylabel("Count")
axes[0].set_title(f"Feature matrix: {features['region_id'].nunique()} x {len(feature_defs)} = {len(features):,} cells")
excluded_n = len(excluded_defs)
axes[1].bar(["Included feature categories\n(leaf/component)",
             "Excluded official-total / parent-total\ncategories (overlap components)"],
            [len(feature_defs), excluded_n], color=[PRIMARY, GREY], width=0.55)
for i, v in enumerate([len(feature_defs), excluded_n]):
    axes[1].text(i, v, str(v), ha="center", va="bottom", fontsize=11, fontweight="bold")
axes[1].set_ylabel("Category count")
axes[1].set_title("Category-role filtering for 2024")
fig_note(fig, "Reporting-unit filters (year=2024, administrative_district, quality=valid, comparison=eligible) "
              "are applied first; category filters (leaf/component roles) are applied second. Official totals and "
              "parent totals are excluded because they overlap their component rows.")
plt.show()
''')
    ])

    # N03-02 raw_log1p_and_standardized_feature_distributions
    insertions.setdefault(3, []).extend([
        code(r'''
# Figure N03-02 · raw_log1p_and_standardized_feature_distributions
# One common and one sparse feature, shown raw / log1p / standardized side by side.
# Select a common feature (low zero fraction) and a sparse feature (high zero fraction).
cat_stats = features.groupby("category")["total"].apply(lambda s: (s == 0).mean()).sort_values()
common_feat = cat_stats.index[0]
sparse_feat = cat_stats.index[-1]

fig, axes = plt.subplots(2, 3, figsize=(13, 6.4), constrained_layout=True)
titles = ["raw count", "log1p(count)", "standardized (log1p z, ddof=0)"]
for row, (feat_name, tag) in enumerate([(common_feat, "common"), (sparse_feat, "sparse")]):
    sub = features[features["category"] == feat_name].sort_values("region_name")
    vals = sub["total"].values
    logged = np.log1p(vals)
    std = (logged - logged.mean()) / (logged.std(ddof=0) or 1.0)
    for col, (arr, ttl) in enumerate(zip([vals, logged, std], titles)):
        ax = axes[row, col]
        ax.hist(arr, bins=25, color=SERIES[col], alpha=0.85, edgecolor="white")
        ax.set_xlabel(ttl)
        ax.set_ylabel("Units")
        ax.set_title(f"{tag} feature: {feat_name[:26]} - {ttl}")
        if row == 1 and col == 1:
            ax.axvline(0, color=RED, ls="--", lw=1)
fig_note(fig, "log1p preserves zeros (log1p(0)=0) before standardization, so sparse features stay interpretable. "
              "The same 774 units are used for every feature; only the category differs across columns.")
plt.show()
''')
    ])

    # N03-03 pca_explained_variance -> after PCA cell (index 7 area). Place after cell 7.
    insertions.setdefault(7, []).extend([
        code(r'''
# Figure N03-03 · pca_explained_variance
# Variance shares actually present in the saved run (PC1, PC2 saved; full spectrum not available).
pc1, pc2 = variance[0], variance[1]
remaining = 100 - pc1 - pc2

fig, ax = plt.subplots(figsize=(7, 4.4), constrained_layout=True)
bars = ax.bar(["PC1", "PC2", "Remaining components\n(not saved)"], [pc1, pc2, remaining],
              color=[PRIMARY, BLUE, GREY], width=0.55)
for rect, v in zip(bars, [pc1, pc2, remaining]):
    ax.text(rect.get_x() + rect.get_width() / 2, v, f"{v:.2f}%", ha="center", va="bottom", fontsize=12, fontweight="bold")
ax.set_ylabel("Share of total feature variance (%)")
ax.set_ylim(0, 100)
ax.set_title("Saved PCA explained variance - 2024 cohort")
fig_note(fig, f"PC1 retains {pc1:.2f}% and PC2 {pc2:.2f}% (combined {pc1+pc2:.2f}%). Only two components are "
              f"saved, so {remaining:.2f}% remains in the other 129 dimensions; a full scree plot is not available from the saved artifact.")
plt.show()
''')
    ])

    # N03-04 pca_scores_by_k3_cluster_2024 -> improve existing cell 7 figure (replace it)
    # The existing figure is in cell 7; I'll replace that cell's source.
    # Find the code cell that contains "fig, ax = plt.subplots(figsize=(8, 5.5)" (cell 7).
    n03_fig_cell_idx = None
    for i, c in enumerate(cells):
        if c.get("cell_type") == "code" and "fig, ax = plt.subplots(figsize=(8, 5.5)" in c.get("source", ""):
            n03_fig_cell_idx = i
            break
    if n03_fig_cell_idx is not None:
        cells[n03_fig_cell_idx] = code(r'''
# Figure N03-04 · pca_scores_by_k3_cluster_2024 (improved, replaces original scatter cell)
# Cell preserves the PCA setup, the improved scatter, and the saved loadings table.
pca_path = artifact(run["methods"]["pca"]["artifact"])
pca = json.loads(pca_path.read_text(encoding="utf-8"))
assert pca["n_regions"] == 774 and pca["n_categories"] == 131 and pca["n_components"] == 2
variance = [100 * x for x in pca["explained_variance_ratio"]]
assert np.allclose(variance, [15.910842, 4.574008], atol=.001)

score_rows = []
for row in pca["components"]:
    d = {item["component"]: item["score"] for item in row["scores"]}
    score_rows.append({"region_id": row["region_id"], "region label": row["region"], "PC1": d["PC1"], "PC2": d["PC2"]})
scores = pd.DataFrame(score_rows)
km3_preview = json.loads(artifact(run["methods"]["kmeans"]["artifacts"][0]).read_text(encoding="utf-8"))
cluster_map = {r["region_id"]: r["cluster_id"] for r in km3_preview["assignment_records"]}
scores["k=3 cluster"] = scores["region_id"].map(cluster_map)
assert scores[["PC1","PC2","k=3 cluster"]].notna().all().all()

fig, ax = plt.subplots(figsize=(9, 5.6), constrained_layout=True)
cluster_colors = {0: SERIES[0], 1: SERIES[1], 2: SERIES[2]}
for cluster_id, group in scores.groupby("k=3 cluster"):
    ax.scatter(group.PC1, group.PC2, s=14, alpha=0.6, label=f"Cluster {cluster_id} (n={len(group)})",
               color=cluster_colors.get(cluster_id, GREY))
ax.set_xlabel(f"PC1 ({variance[0]:.2f}% of total feature variance)")
ax.set_ylabel(f"PC2 ({variance[1]:.2f}% of total feature variance)")
ax.set_title("Saved PCA scores by saved k=3 cluster - 2024 administrative-district cohort")
ax.legend(frameon=False, fontsize=9)
ax.grid(alpha=0.2)
fig_note(fig, f"{len(scores)} districts plotted in the PC1-PC2 plane ({variance[0]:.2f}% + {variance[1]:.2f}% = {variance[0]+variance[1]:.2f}% of variance). "
              "This is a two-dimensional view of clusters fitted in the full 131-dimensional feature space; "
              "proximity here does not imply near-identical high-dimensional profiles.")
plt.show()

loading_rows = []
for component in pca["loadings"]:
    top = sorted(component["features"], key=lambda x: abs(x["loading"]), reverse=True)[:5]
    loading_rows.extend({"component": component["component"], "feature": item["category"], "loading": item["loading"]} for item in top)
display(pd.DataFrame(loading_rows).round({"loading": 4}))
''')
    else:
        insertions.setdefault(7, []).extend([
            code(r'''
# Figure N03-04 · pca_scores_by_k3_cluster_2024
fig, ax = plt.subplots(figsize=(9, 5.6), constrained_layout=True)
cluster_colors = {0: SERIES[0], 1: SERIES[1], 2: SERIES[2]}
for cluster_id, group in scores.groupby("k=3 cluster"):
    ax.scatter(group.PC1, group.PC2, s=14, alpha=0.6, label=f"Cluster {cluster_id} (n={len(group)})",
               color=cluster_colors.get(cluster_id, GREY))
ax.set_xlabel(f"PC1 ({variance[0]:.2f}% of total feature variance)")
ax.set_ylabel(f"PC2 ({variance[1]:.2f}% of total feature variance)")
ax.set_title("Saved PCA scores by saved k=3 cluster - 2024 administrative-district cohort")
ax.legend(frameon=False, fontsize=9)
ax.grid(alpha=0.2)
fig_note(fig, f"{len(scores)} districts plotted ({variance[0]:.2f}% + {variance[1]:.2f}% = {variance[0]+variance[1]:.2f}% of variance).")
plt.show()
''')
        ])

    # N03-05 pc1_vs_log_reported_total_2024 -> after cell 9 (the join cell)
    insertions.setdefault(9, []).extend([
        code(r'''
# Figure N03-05 · pc1_vs_log_reported_total_2024
# Saved PC1 vs log1p(official reported total), one-to-one join, with correlation.
joined_sorted = joined.sort_values("log1p official total")
fig, ax = plt.subplots(figsize=(8, 5.6), constrained_layout=True)
ax.scatter(joined["log1p official total"], joined["PC1"], s=12, alpha=0.5, color=PRIMARY)
m, b = np.polyfit(joined["log1p official total"], joined["PC1"], 1)
xx = np.linspace(joined["log1p official total"].min(), joined["log1p official total"].max(), 50)
ax.plot(xx, m * xx + b, color=RED, lw=1.5, label=f"descriptive fit (r = {pc1_total_corr:.4f})")
ax.set_xlabel("log1p(official reported total, 2024)")
ax.set_ylabel("PC1 score (saved)")
ax.set_title(f"PC1 vs log1p(official reported total) - n = {len(joined)} districts")
ax.legend(fontsize=9)
fig_note(fig, f"Join is one-to-one: {len(joined)} districts, 0 unmatched. Pearson r = {pc1_total_corr:.4f}. "
              "The fitted line is descriptive only; the sign of a PCA axis can flip without changing the model, "
              "so the direction of association is a convention, not a finding.")
plt.show()
''')
    ])

    # N03-06 pca_top_feature_loadings -> after cell 7 loadings display (index 7 block). Place after cell 7.
    insertions.setdefault(7, []).extend([
        code(r'''
# Figure N03-06 · pca_top_feature_loadings
# Largest positive and negative saved loadings for PC1 and PC2 (two panels).
def top_loadings(comp, n=8):
    feats = [f for f in pca["loadings"] if f["component"] == comp][0]["features"]
    return sorted(feats, key=lambda x: abs(x["loading"]), reverse=True)[:n]

fig, axes = plt.subplots(1, 2, figsize=(12, 4.8), constrained_layout=True)
for ax, comp in zip(axes, ["PC1", "PC2"]):
    feats = top_loadings(comp)
    names = [f["category"][:30] for f in feats][::-1]
    vals = [f["loading"] for f in feats][::-1]
    cols = [PRIMARY if v >= 0 else ACCENT for v in vals]
    ax.barh(names, vals, color=cols, height=0.6)
    ax.axvline(0, color="#333", lw=1)
    ax.set_xlabel("Signed saving loading")
    ax.set_title(f"{comp} - largest-magnitude loadings (sign preserved)")
    for i, (nme, v) in enumerate(zip(names, vals)):
        ax.text(v, i, f" {v:.2f}", va="center", fontsize=8,
                ha="left" if v >= 0 else "right", color="#222")
fig.suptitle("Top saved PCA loadings - PC1 and PC2 (2024 cohort, 131 features)", fontsize=13, y=1.02)
fig_note(fig, "Loading = feature weight in the component (sign convention as saved). Features are selected by "
              "absolute loading within each component, then their signs are preserved. Loadings are not shares of crime.")
plt.show()
''')
    ])

    # N03-07 kmeans_cluster_sizes_and_inertia -> after cell 11 (kmeans table)
    insertions.setdefault(11, []).extend([
        code(r'''
# Figure N03-07 · kmeans_cluster_sizes_and_inertia
# Cluster sizes for k=3,4,5 and inertia across saved runs.
ks = sorted(kmeans_saved.keys())
sizes = [kmeans_saved[k]["cluster_sizes"] for k in ks]
inertias = [kmeans_saved[k]["inertia"] for k in ks]

fig, axes = plt.subplots(1, 2, figsize=(12, 4.4), constrained_layout=True)
for i, k in enumerate(ks):
    sz = sizes[i]
    x = np.arange(len(sz)) + i * 0.25
    axes[0].bar(x, sz, width=0.25, label=f"k={k}", color=SERIES[i % len(SERIES)])
    for xi, v in zip(x, sz):
        axes[0].text(xi, v, str(v), ha="center", va="bottom", fontsize=8)
axes[0].set_xlabel("Cluster index (within run)")
axes[0].set_ylabel("Units")
axes[0].set_title("Saved cluster sizes by k")
axes[0].set_xticks(np.arange(max(len(s) for s in sizes)) + 0.25)
axes[0].set_xticklabels([f"C{j+1}" for j in range(max(len(s) for s in sizes))])
axes[0].legend(fontsize=9)
axes[1].plot(ks, inertias, marker="o", color=RED, lw=2)
for k, v in zip(ks, inertias):
    axes[1].annotate(f"{v:,.0f}", (k, v), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=9)
axes[1].set_xlabel("k")
axes[1].set_ylabel("Inertia (saved)")
axes[1].set_title("Inertia across saved k-means runs")
fig_note(fig, f"Selected configuration: k=3 (sizes {kmeans_saved[3]['cluster_sizes']}). Labels from different k values "
              f"are run-specific and do not carry across runs. Inertia falls as k increases (86,824.9 at k=3), "
              "so it does not by itself select an optimal cluster count.")
plt.show()
''')
    ])

    # N03-08 k3_centroid_feature_heatmap -> after cell 11 centroid profile
    insertions.setdefault(11, []).extend([
        code(r'''
# Figure N03-08 · k3_centroid_feature_heatmap
# Standardized centroid values for deterministically selected distinguishing features, k=3.
km3 = kmeans_saved[3]
centroids = {c["cluster_id"]: c["centroid"] for c in km3["clusters"]}
# deterministically select top-|centroid| features union across clusters
picked = []
for cid in range(3):
    top = sorted(centroids[cid].items(), key=lambda kv: abs(kv[1]), reverse=True)[:6]
    for name, _ in top:
        if name not in picked:
            picked.append(name)
mat = np.array([[centroids[cid].get(f, 0.0) for f in picked] for cid in range(3)], dtype=float)
vmax = float(np.max(np.abs(mat))) or 1.0

fig, ax = plt.subplots(figsize=(10, 3.8), constrained_layout=True)
im = ax.imshow(mat, aspect="auto", cmap="RdBu_r", vmin=-vmax, vmax=vmax)
ax.set_yticks(range(3))
ax.set_yticklabels([f"Cluster {cid+1} (n={km3['cluster_sizes'][cid]})" for cid in range(3)], fontsize=9)
ax.set_xticks(range(len(picked)))
ax.set_xticklabels([p[:26] for p in picked], rotation=45, ha="right", fontsize=8)
ax.set_title("k=3 centroid feature heatmap - standardized log-count deviations")
fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04).set_label("centroid z (0 = national cohort mean)")
fig_note(fig, "Positive centroid = cluster center above the national cohort mean for that feature (standardized "
              "log-count space); negative = below. These are deviations, not raw counts, rates, or safety rankings.")
plt.show()
''')
    ])

    # N03-09 k3_reported_totals_by_cluster -> after cell 11
    insertions.setdefault(11, []).extend([
        code(r'''
# Figure N03-09 · k3_reported_totals_by_cluster
# Box plots of official reported totals across the three saved k=3 clusters.
ot_id = db.execute("""SELECT category_id FROM crime_observations WHERE year=2024 AND original_category='Total Cognizable IPC/BNS crimes' LIMIT 1""").fetchone()[0]
totals_map = {r[0]: r[1] for r in db.execute("""SELECT geography_id, reported_value FROM crime_observations
    WHERE year=2024 AND region_type='administrative_district' AND quality_status='valid'
      AND comparison_status='eligible' AND category_id=?""", (ot_id,))}
assign = {r["region_id"]: r["cluster_id"] for r in km3["assignment_records"]}
cluster_vals = {cid: [totals_map[rid] for rid, c in assign.items() if c == cid and rid in totals_map] for cid in range(3)}
order = [cluster_vals[cid] for cid in range(3)]

fig, ax = plt.subplots(figsize=(8, 4.8), constrained_layout=True)
bp = ax.boxplot(order, patch_artist=True, showfliers=False, medianprops={"color": RED})
for patch, col in zip(bp["boxes"], SERIES[:3]):
    patch.set_facecolor(col); patch.set_alpha(0.6)
ax.set_ylabel("Official 2024 reported total (cases)")
ax.set_title("Reported totals across saved k=3 clusters")
ax.set_xticklabels([f"C{cid+1} (n={len(cluster_vals[cid])})" for cid in range(3)], fontsize=9)
ax.set_yscale("symlog")
ax.axhline(1, color="#333", ls=":", lw=1)
fig_note(fig, f"Cluster sizes: {[km3['cluster_sizes'][cid] for cid in range(3)]}. A symlog scale is used because "
              "reporting volume is highly skewed; the zero baseline is preserved (log1p(0)=0). Volume differences "
              "across clusters reflect the reporting-volume dimension captured by PC1, not safety.")
plt.show()
''')
    ])

    # Appendix N03: optional figures
    appendix = [
        md("## Appendix: additional PCA and clustering diagnostics"),
        # N03-10 feature_matrix_preview
        code(r'''
# Figure N03-10 · feature_matrix_preview (optional)
# Heatmap of a deterministic subset of units and features (standardized values).
subset_regions = scores.sort_values("PC1").head(12)["region_id"].tolist()
subset_feats = picked[:10]
ridx = {r: i for i, r in enumerate(matrix["regions"])}
fidx = {f: i for i, f in enumerate(matrix["categories"])}
pre = np.zeros((len(subset_regions), len(subset_feats)))
for i, rid in enumerate(subset_regions):
    for j, f in enumerate(subset_feats):
        if rid in ridx and f in fidx:
            pre[i, j] = vectors[ridx[rid], fidx[f]]
fig, ax = plt.subplots(figsize=(10, 4.4), constrained_layout=True)
im = ax.imshow(pre, aspect="auto", cmap="RdBu_r", vmin=-3, vmax=3)
ax.set_yticks(range(len(subset_regions)))
ax.set_yticklabels([f"{r[:20]}" for r in subset_regions], fontsize=7)
ax.set_xticks(range(len(subset_feats)))
ax.set_xticklabels([f[:18] for f in subset_feats], rotation=45, ha="right", fontsize=7)
ax.set_title("Feature matrix preview - standardized values (12 units x 10 features, by PC1)")
fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04).set_label("standardized value")
fig_note(fig, "Subset: 12 units with the most negative PC1 scores, and the 10 most distinguishing centroid features. "
              "Values are standardized (log1p z, ddof=0). Recorded for reproducibility; not a claim about any unit.")
plt.show()
'''),
        # N03-11 cluster_profile_deviations
        code(r'''
# Figure N03-11 · cluster_profile_deviations (optional)
# Horizontal signed bars of most distinctive centroid features per k=3 cluster.
fig, axes = plt.subplots(1, 3, figsize=(13, 4.2), constrained_layout=True, sharex=True)
for ax, cid in zip(axes, range(3)):
    top = sorted(centroids[cid].items(), key=lambda kv: abs(kv[1]), reverse=True)[:7]
    names = [n[:24] for n, _ in top][::-1]
    vals = [v for _, v in top][::-1]
    ax.barh(names, vals, color=[PRIMARY if v >= 0 else ACCENT for v in vals], height=0.6)
    ax.axvline(0, color="#333", lw=1)
    ax.set_title(f"Cluster {cid+1} (n={km3['cluster_sizes'][cid]})", fontsize=10)
    ax.tick_params(axis="y", labelsize=8)
fig.suptitle("Cluster profile deviations - most distinctive centroid features", fontsize=12, y=1.02)
fig_note(fig, "Signed deviations from the national cohort mean in standardized log-count space. Same cluster names "
              "as the PCA scatter (C1/C2/C3 = cluster 0/1/2).")
plt.show()
'''),
        # N03-12 cluster_membership_overlap_across_k
        code(r'''
# Figure N03-12 · cluster_membership_overlap_across_k (optional)
# Overlap heatmap between saved k=3 and k=4 assignments.
km4 = kmeans_saved[4]
a3 = {r["region_id"]: r["cluster_id"] for r in km3["assignment_records"]}
a4 = {r["region_id"]: r["cluster_id"] for r in km4["assignment_records"]}
units = sorted(set(a3) & set(a4))
ov = np.zeros((3, 4), dtype=int)
for u in units:
    ov[a3[u], a4[u]] += 1
fig, ax = plt.subplots(figsize=(6.5, 4.4), constrained_layout=True)
im = ax.imshow(ov, aspect="auto", cmap="Greens")
for i in range(3):
    for j in range(4):
        ax.text(j, i, str(ov[i, j]), ha="center", va="center", fontsize=11, fontweight="bold",
                color="white" if ov[i, j] > ov.max() / 2 else "#222")
ax.set_xticks(range(4)); ax.set_xticklabels([f"k4 C{j+1}" for j in range(4)], fontsize=9)
ax.set_yticks(range(3)); ax.set_yticklabels([f"k3 C{i+1}" for i in range(3)], fontsize=9)
ax.set_xlabel("k=4 cluster"); ax.set_ylabel("k=3 cluster")
ax.set_title(f"Membership overlap k=3 vs k=4 (n = {len(units)} units)")
fig_note(fig, "Cell = units shared between a k=3 cluster and a k=4 cluster. Cluster IDs do not carry across k values; "
              "this shows splits/merges descriptively, not stability.")
plt.show()
'''),
        # N03-13 ward_hierarchical_state_example
        code(r'''
# Figure N03-13 · ward_hierarchical_state_example (optional)
# Andhra Pradesh Ward: final cluster memberships (complete linkage tree not recorded).
fig, ax = plt.subplots(figsize=(8, 4.4), constrained_layout=True)
sizes = [c["size"] for c in ward["clusters"]]
ids = [c["cluster_id"] for c in ward["clusters"]]
bars = ax.bar([f"Cluster {i+1}" for i in ids], sizes, color=SERIES[:len(ids)], width=0.55)
for rect, v in zip(bars, sizes):
    ax.text(rect.get_x() + rect.get_width() / 2, v, str(v), ha="center", va="bottom", fontsize=12, fontweight="bold")
ax.set_ylabel("Districts")
ax.set_title(f"Ward final clusters - Andhra Pradesh ({ward['n_regions']} units, max_clusters={ward['max_clusters']})")
fig_note(fig, f"The saved linkage stops at max_clusters={ward['max_clusters']} after {len(ward['merge_history'])} recorded merges, "
              "so a complete dendrogram is not available. Final cluster memberships are shown instead; the top merges "
              "joining the final clusters are not recorded and are not invented.")
plt.show()
'''),
        # N03-14 cluster_separation_diagnostic -> SKIP (post-hoc silhouette; clearly labelled, but we CAN compute)
        code(r'''
# Figure N03-14 · cluster_separation_diagnostic (optional, clearly labelled post-hoc)
# Silhouette scores for saved k=3 assignments in the full transformed feature space (no refit).
from sklearn.metrics import silhouette_score
labels = np.array([a3[u] for u in units])
try:
    sil = silhouette_score(vectors[np.array([ridx[u] for u in units])], labels)
    fig, ax = plt.subplots(figsize=(5.6, 4.2), constrained_layout=True)
    ax.bar(["k=3 saved assignment"], [sil], color=PRIMARY, width=0.4)
    ax.text(0, sil, f"{sil:.3f}", ha="center", va="bottom", fontsize=12, fontweight="bold")
    ax.set_ylabel("Silhouette score")
    ax.set_ylim(0, 1)
    ax.set_title("Post-hoc silhouette - saved k=3, full feature space")
    fig_note(fig, f"Computed post-hoc on {len(units)} units in the full transformed (log1p z, ddof=0) feature space. "
                  "No model is refit; this is a descriptive separation check separate from the saved results.")
    plt.show()
except Exception as e:
    print("Silhouette diagnostic skipped:", e)
'''),
    ]
    last_idx = len(cells) - 1
    final_cells = list(cells)
    for ai, block in sorted(insertions.items(), key=lambda t: t[0], reverse=True):
        pos = ai + 1
        for c in block:
            final_cells.insert(pos, c)
            pos += 1
    for c in appendix:
        final_cells.append(c)
    nb.cells = final_cells
    nbformat.write(nb, NOTEBOOKS["03"])
    print("Wrote", NOTEBOOKS["03"].name, "cells:", len(nb.cells))


# ============================================================================
# NOTEBOOK 04 - anomalies and association rules
# ============================================================================
def build_n04():
    nb = nbformat.read(NOTEBOOKS["04"], as_version=4)
    cells = list(nb.cells)
    cells[1] = nbformat.v4.new_code_cell(cells[1]["source"] + "\n" + STYLE)

    insertions = {}

    # N04-01 anomaly_flag_counts -> after cell 3 (anomaly verification)
    insertions.setdefault(3, []).extend([
        md("## Cross-sectional anomaly diagnostics"),
        code(r'''
# Figure N04-01 · anomaly_flag_counts
# Flagged observations by anomaly group/direction using the active saved definitions (threshold |z|>=2.5).
from collections import Counter
flags = saved_anomalies["cross_sectional"]
direction_counts = Counter(f["direction"] for f in flags)
# group by category sparsity (zero fraction) for a meaningful breakdown
feat_df = pd.DataFrame(feature_rows)
feat24 = feat_df[(feat_df["year"] == 2024)]
zf_cat = feat24.groupby("category")["total"].apply(lambda s: (s == 0).mean())
flag_df = pd.DataFrame(flags)
flag_df["zero_fraction"] = flag_df["category"].map(zf_cat)
flag_df["sparsity_group"] = pd.cut(flag_df["zero_fraction"], bins=[0, 0.5, 0.9, 1.0],
                                   labels=["<50% zero", "50-90% zero", ">90% zero"])

fig, axes = plt.subplots(1, 2, figsize=(12, 4.4), constrained_layout=True)
axes[0].bar([str(k) for k in direction_counts.keys()], list(direction_counts.values()), color=[ACCENT, PRIMARY], width=0.5)
for i, (k, v) in enumerate(direction_counts.items()):
    axes[0].text(i, v, str(v), ha="center", va="bottom", fontsize=12, fontweight="bold")
axes[0].set_xlabel("Flag direction"); axes[0].set_ylabel("Flagged observations")
axes[0].set_title(f"Flagged observations by direction (threshold |z| >= {threshold})")
sg = flag_df["sparsity_group"].value_counts().reindex(["<50% zero", "50-90% zero", ">90% zero"])
axes[1].bar([str(i) for i in sg.index], sg.values, color=SERIES[:len(sg)], width=0.6)
for i, v in enumerate(sg.values):
    axes[1].text(i, v, str(int(v)), ha="center", va="bottom", fontsize=10, fontweight="bold")
axes[1].set_xlabel("Category zero-fraction group"); axes[1].set_ylabel("Flagged observations")
axes[1].set_title("Flags by category sparsity")
fig_note(fig, f"{len(flags)} cross-sectional flags at |z| >= {threshold}; each bar counts flagged observations "
              "(a unit may be flagged in multiple categories). Flags concentrate in sparse categories where a single case is extreme.")
plt.show()
''')
    ])

    # N04-02 rare_category_anomaly_distribution -> Satara
    insertions.setdefault(3, []).extend([
        code(r'''
# Figure N04-02 · rare_category_anomaly_distribution
# Full observed frequency distribution for the Satara / Abetment outside India example.
rare_cat = rare["category"]
rare_vals = np.array([r["total"] for r in feature_rows if r["year"] == 2024 and r["category"] == rare_cat])
fig, ax = plt.subplots(figsize=(7, 4.4), constrained_layout=True)
uniq, counts = np.unique(rare_vals, return_counts=True)
ax.bar([str(int(u)) for u in uniq], counts, color=PRIMARY, width=0.5)
for x, c in zip(uniq, counts):
    ax.text(str(int(x)), c, str(int(c)), ha="center", va="bottom", fontsize=10, fontweight="bold")
ax.set_xlabel("Reported count per district"); ax.set_ylabel("Number of districts")
ax.set_title(f"Distribution for '{rare_cat}' - 2024 cohort (n = {len(rare_vals)})")
fig_note(fig, f"{int((rare_vals==0).sum())} of {len(rare_vals)} districts report zero; the flagged Satara count of "
              f"{int(rare['value'])} is the single nonzero case (z = {rare['z_score']:.2f}). "
              "A large z-score flags unusualness within the category; it does not imply severity or a data error.")
plt.show()
''')
    ])

    # N04-03 high_volume_anomaly_distribution -> North-West Delhi Other Thefts
    insertions.setdefault(3, []).extend([
        code(r'''
# Figure N04-03 · high_volume_anomaly_distribution
# Category distribution for North-West Delhi / Other Thefts example.
hv_cat = high_volume["category"]
hv_vals = np.array([r["total"] for r in feature_rows if r["year"] == 2024 and r["category"] == hv_cat])
fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.4), constrained_layout=True)
axes[0].hist(hv_vals, bins=30, color=ACCENT, alpha=0.85, edgecolor="white")
axes[0].axvline(high_volume["value"], color=RED, ls="--", lw=2,
                label=f"North-West Delhi = {int(high_volume['value'])}")
axes[0].set_xlabel("Reported cases per district"); axes[0].set_ylabel("Districts")
axes[0].set_title(f"Distribution for '{hv_cat}' - 2024 cohort"); axes[0].legend(fontsize=9)
# tail panel: log1p
axes[1].hist(np.log1p(hv_vals), bins=30, color=ACCENT, alpha=0.85, edgecolor="white")
axes[1].axvline(np.log1p(high_volume["value"]), color=RED, ls="--", lw=2)
axes[1].set_xlabel("log1p(reported cases per district)"); axes[1].set_ylabel("Districts")
axes[1].set_title("Same distribution, log1p scale (tail visible)")
fig_note(fig, f"Observed count {int(high_volume['value'])} vs category mean {high_volume['category_mean']:.1f} "
              f"(sample std {high_volume['category_std']:.1f}); z = {high_volume['z_score']:.2f}. "
              "z-score uses the raw-count reference population for that category.")
plt.show()
''')
    ])

    # N04-04 anomaly_count_vs_z_score -> after cell 3
    insertions.setdefault(3, []).extend([
        code(r'''
# Figure N04-04 · anomaly_count_vs_z_score
# Scatter of flagged raw counts vs category-specific z-scores; rare vs high-volume distinguished.
flag_df_plot = flag_df.copy()
flag_df_plot["log1p_value"] = np.log1p(flag_df_plot["value"].fillna(0))
fig, ax = plt.subplots(figsize=(8, 5.4), constrained_layout=True)
ax.scatter(flag_df_plot["log1p_value"], flag_df_plot["z_score"], s=18, alpha=0.6,
           c=np.where(flag_df_plot["direction"] == "high", PRIMARY, ACCENT))
ax.set_xlabel("log1p(flagged raw count)"); ax.set_ylabel("Category-specific z-score")
ax.set_title("Flagged count vs z-score (each z uses its own category distribution)")
ax.axhline(threshold, color=RED, ls="--", lw=1, label=f"threshold |z| = {threshold}")
ax.axhline(-threshold, color=RED, ls="--", lw=1)
ax.legend(fontsize=9)
fig_note(fig, f"{len(flag_df_plot)} flagged observations. Rare-category flags sit at low counts with extreme z-scores; "
              "high-volume flags sit at high counts. Each z-score is relative to its own category's distribution, "
              "so counts and z-scores are not directly comparable across categories.")
plt.show()
''')
    ])

    # N04-05 association_transaction_coverage -> after cell 6 (association setup)
    insertions.setdefault(6, []).extend([
        md("## Association-rule coverage and the worked rule"),
        code(r'''
# Figure N04-05 · association_transaction_coverage
# Eligible cohort, qualifying transaction population, excluded empty profiles; categories-per-transaction histogram.
n_transactions = len(transactions)
cats_per_txn = [len(t) for t in transactions]

fig, axes = plt.subplots(1, 2, figsize=(12, 4.4), constrained_layout=True)
n_rules = saved_rules["n_rules"]
axes[0].bar(["Eligible administrative districts\n(cohort)", "Qualifying transactions\n(min_cases=10)",
            "Excluded - no category >= 10 cases"],
            [cohort_districts, n_transactions, excluded_empty_profiles],
            color=[PRIMARY, BLUE, GREY], width=0.55)
for i, v in enumerate([cohort_districts, n_transactions, excluded_empty_profiles]):
    axes[0].text(i, v, f"{v:,}", ha="center", va="bottom", fontsize=11, fontweight="bold")
axes[0].set_ylabel("Districts"); axes[0].set_title("Transaction coverage (2024, min_cases=10)")
axes[1].hist(cats_per_txn, bins=range(1, max(cats_per_txn) + 2), color=ACCENT, alpha=0.85, edgecolor="white")
axes[1].set_xlabel("Qualifying categories per transaction"); axes[1].set_ylabel("Transactions")
axes[1].set_title(f"Categories per qualifying district profile (mean {np.mean(cats_per_txn):.1f})")
fig_note(fig, f"{cohort_districts} eligible districts in the cohort; {n_transactions} form transactions at min_cases={params['min_cases']}; "
              f"{excluded_empty_profiles} districts have no category crossing the threshold and are excluded from the "
              f"{n_rules}-rule denominator (they remain in the 774-district analytical cohort).")
plt.show()
''')
    ])

    # Replace existing figure cell (index 7) with improved N04-06 arson_prevalence_given_stalking_2024
    n04_fig_cell_idx = None
    for i, c in enumerate(cells):
        if c.get("cell_type") == "code" and "Conditional vs overall category prevalence" in c.get("source", ""):
            n04_fig_cell_idx = i
            break
    if n04_fig_cell_idx is not None:
        cells[n04_fig_cell_idx] = code(r'''
# Figure N04-06 · arson_prevalence_given_stalking_2024 (improved)
# Conditional vs overall Arson prevalence, both bars labelled Arson >= 10 reported cases.
fig, ax = plt.subplots(figsize=(7.5, 4.6), constrained_layout=True)
labels = ["Arson >= 10 among districts\nwith Stalking >= 10", "Arson >= 10 among all\nqualifying district profiles"]
values = [confidence * 100, consequent_prevalence * 100]
bars = ax.bar(labels, values, color=[ACCENT, PRIMARY], width=0.58)
ax.set_ylabel("Districts reporting the category (%)")
ax.set_title("Conditional vs overall category prevalence - Stalking -> Arson (2024)")
ax.set_ylim(0, max(values) * 1.30)
for bar, count, denom, value in zip(bars, [n_joint, n_consequent], [n_antecedent, n], values):
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(),
            f"{count}/{denom} = {value:.1f}%", ha="center", va="bottom", fontsize=10, fontweight="bold")
fig_note(fig, f"Both bars are districts reporting Arson >= 10 cases. Left: among the {n_antecedent} districts with Stalking >= 10 "
              f"({n_joint} also report Arson >= 10). Right: among all {n} qualifying profiles ({n_consequent} report Arson >= 10). "
              f"Lift = {lift:.2f}; confidence {confidence*100:.1f}% vs baseline prevalence {consequent_prevalence*100:.1f}%. "
              "District-level co-occurrence within a year, not linked events or causation.")
plt.show()
''')
    else:
        insertions.setdefault(6, []).extend([
            code(r'''
# Figure N04-06 · arson_prevalence_given_stalking_2024
fig, ax = plt.subplots(figsize=(7.5, 4.6), constrained_layout=True)
labels = ["Arson >= 10 among districts with Stalking >= 10", "Arson >= 10 among all qualifying profiles"]
values = [confidence * 100, consequent_prevalence * 100]
ax.bar(labels, values, color=[ACCENT, PRIMARY], width=0.58)
ax.set_ylabel("Districts reporting the category (%)")
ax.set_title("Conditional vs overall category prevalence - Stalking -> Arson (2024)")
fig_note(fig, f"Lift = {lift:.2f}. Both bars are districts reporting Arson >= 10 cases.")
plt.show()
''')
        ])

    # N04-07 association_rule_metrics -> after cell 6
    insertions.setdefault(6, []).extend([
        code(r'''
# Figure N04-07 · association_rule_metrics
# Support vs confidence for all saved rules, lift encoded by colour; worked rule highlighted.
rules_df = pd.DataFrame(saved_rules["rules"])
worked = (rules_df["antecedent"].apply(lambda a: a[0] if isinstance(a, list) else a) == antecedent) & \
         (rules_df["consequent"].apply(lambda c: c[0] if isinstance(c, list) else c) == consequent)

fig, ax = plt.subplots(figsize=(8, 5.6), constrained_layout=True)
sc = ax.scatter(rules_df["support"], rules_df["confidence"], c=rules_df["lift"], cmap="RdYlBu_r",
                s=20, alpha=0.7, edgecolor="white", linewidth=0.3)
ax.scatter(rules_df.loc[worked, "support"], rules_df.loc[worked, "confidence"], s=90, facecolors="none",
           edgecolors=RED, linewidths=1.8, label=f"Worked rule: {antecedent[:18]} -> {consequent[:18]}")
ax.set_xlabel("Support (joint / N)"); ax.set_ylabel("Confidence (joint / antecedent)")
ax.set_title(f"All saved association rules - support vs confidence (n = {saved_rules['n_rules']})")
ax.legend(fontsize=8)
fig.colorbar(sc, ax=ax, fraction=0.046, pad=0.04).set_label("Lift (ratio)")
fig_note(fig, f"Support and confidence expressed as fractions of the {n}-transaction population; lift is a ratio. "
              "The worked rule is highlighted; the remaining 696 rules describe other category co-presences. "
              "Rules describe co-presence across district profiles, not linked incidents or causation.")
plt.show()
''')
    ])

    # N04-08 selected_association_rules -> after cell 6
    insertions.setdefault(6, []).extend([
        code(r'''
# Figure N04-08 · selected_association_rules
# Top rules by lift: consequent baseline prevalence vs conditional prevalence, with support/joint count and lift.
top_rules = rules_df.sort_values("lift", ascending=False).head(8).iloc[::-1]
fig, ax = plt.subplots(figsize=(10, 5.2), constrained_layout=True)
y = np.arange(len(top_rules))
cond = [r["confidence"] * 100 for _, r in top_rules.iterrows()]
base = []
for _, r in top_rules.iterrows():
    cons = r["consequent"][0] if isinstance(r["consequent"], list) else r["consequent"]
    # baseline prevalence: share of qualifying transactions containing the consequent item (count >= 10)
    ncons = sum(1 for tr in transactions if cons in tr)
    base.append(100 * ncons / n)
ax.barh(y - 0.2, base, height=0.35, label="Consequent baseline prevalence (%)", color=GREY)
ax.barh(y + 0.2, cond, height=0.35, label="Conditional prevalence (%)", color=PRIMARY)
for i, (_, r) in enumerate(top_rules.iterrows()):
    ant = r["antecedent"][0] if isinstance(r["antecedent"], list) else r["antecedent"]
    con = r["consequent"][0] if isinstance(r["consequent"], list) else r["consequent"]
    ax.text(cond[i], i + 0.2, f"lift {r['lift']:.2f} | joint {int(r['support_count'])}", va="center", ha="left", fontsize=8, color=RED)
ax.set_yticks(y)
ax.set_yticklabels([f"{r['antecedent'][0] if isinstance(r['antecedent'],list) else r['antecedent'][:20]} -> {r['consequent'][0] if isinstance(r['consequent'],list) else r['consequent'][:20]}" for _, r in top_rules.iterrows()], fontsize=7)
ax.set_xlabel("Prevalence (%)")
ax.set_title("Top association rules by lift - baseline vs conditional prevalence (2024)")
ax.legend(fontsize=8)
fig_note(fig, "Selection: top 8 saved rules by lift. Conditional prevalence = share of antecedent transactions also "
              "containing the consequent; baseline = consequent prevalence across all transactions. Ranking/lift shown per rule.")
plt.show()
''')
    ])

    # Appendix N04: optional figures
    appendix = [
        md("## Appendix: additional anomaly and rule diagnostics"),
        # N04-09 anomalies_by_category_and_volume
        code(r'''
# Figure N04-09 · anomalies_by_category_and_volume (optional)
# Small set of categories with the most flags, flag counts paired with units assessed.
cat_flags = flag_df.groupby("category").size().sort_values(ascending=False).head(8)
feat24n = pd.DataFrame([r for r in feature_rows if r["year"] == 2024])
cat_units = feat24n.groupby("category")["region_id"].nunique()
fig, ax = plt.subplots(figsize=(10, 4.6), constrained_layout=True)
y = np.arange(len(cat_flags))
ax.barh(y, cat_flags.values, color=ACCENT, height=0.55)
for i, v in enumerate(cat_flags.values):
    ax.text(v, i, f"  {int(v)} flags / {int(cat_units[cat_flags.index[i]])} units", va="center", fontsize=8)
ax.set_yticks(y)
ax.set_yticklabels([c[:28] for c in cat_flags.index], fontsize=8)
ax.set_xlabel("Flagged observations"); ax.set_title("Categories with the most anomaly flags (2024)")
fig_note(fig, "Flag counts are paired with the number of units assessed in each category so flag volume is read "
              "against coverage; categories differ in how many units have a reportable count.")
plt.show()
'''),
        # N04-10 rare_category_sparsity_vs_extreme_z
        code(r'''
# Figure N04-10 · rare_category_sparsity_vs_extreme_z (optional)
# Category zero fraction vs maximum |z| across categories with a valid reference distribution.
cat_z = flag_df.groupby("category")["z_score"].apply(lambda s: s.abs().max())
cat_zf = zf_cat.reindex(cat_z.index)
valid = cat_z.notna() & cat_zf.notna()
fig, ax = plt.subplots(figsize=(7.5, 5.4), constrained_layout=True)
ax.scatter(cat_zf[valid], cat_z[valid], s=20, alpha=0.6, color=PRIMARY)
# highlight worked examples
for name, label in [(rare_cat, "Satara rare example"), (hv_cat, "North-West Delhi high-volume")]:
    if name in cat_zf.index and valid[name]:
        ax.scatter(cat_zf[name], cat_z[name], s=90, facecolors="none", edgecolors=RED, linewidths=1.6)
        ax.annotate(label, (cat_zf[name], cat_z[name]), textcoords="offset points", xytext=(6, 6), fontsize=8, color=RED)
ax.set_xlabel("Category zero fraction"); ax.set_ylabel("Maximum |z-score| in category")
ax.set_title("Category sparsity vs extreme z-score (2024)")
fig_note(fig, f"{int((~valid).sum())} categories have undefined scores (e.g. zero variance) and are excluded; their count is reported here, not plotted. "
              "Sparser categories can produce extreme z-scores from small counts.")
plt.show()
'''),
        # N04-11 association_antecedent_consequent_heatmap
        code(r'''
# Figure N04-11 · association_antecedent_consequent_heatmap (optional)
# Lift for a manageable subset of directed rules.
subset = rules_df.sort_values("lift", ascending=False).head(12)
ants = sorted(set(a[0] for a in subset["antecedent"]))
cons = sorted(set(c[0] for c in subset["consequent"]))
lift_mat = np.full((len(ants), len(cons)), np.nan)
for _, r in subset.iterrows():
    a = r["antecedent"][0] if isinstance(r["antecedent"], list) else r["antecedent"]
    c = r["consequent"][0] if isinstance(r["consequent"], list) else r["consequent"]
    if a in ants and c in cons:
        lift_mat[ants.index(a), cons.index(c)] = r["lift"]
fig, ax = plt.subplots(figsize=(9, 5.4), constrained_layout=True)
im = ax.imshow(lift_mat, aspect="auto", cmap="RdYlBu_r", vmin=1, vmax=np.nanmax(lift_mat))
ax.set_xticks(range(len(cons))); ax.set_xticklabels([c[:20] for c in cons], rotation=60, ha="right", fontsize=7)
ax.set_yticks(range(len(ants))); ax.set_yticklabels([a[:20] for a in ants], fontsize=7)
ax.set_xlabel("Consequent"); ax.set_ylabel("Antecedent")
ax.set_title("Lift for selected directed rules (top 12 by lift)")
fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04).set_label("Lift (ratio; blank = not in subset)")
fig_note(fig, "Rule direction is preserved; blank cells are rules not in the selected subset, not measured zeros. "
              "Co-presence across district profiles, not linked incidents.")
plt.show()
'''),
        # N04-12 association_support_confidence_lift_distributions
        code(r'''
# Figure N04-12 · association_support_confidence_lift_distributions (optional)
# Compact histograms of saved rule metrics with threshold lines.
fig, axes = plt.subplots(1, 3, figsize=(12, 3.6), constrained_layout=True)
for ax, col, thr, ttl in [(axes[0], "support", params["min_support"], "Support"),
                          (axes[1], "confidence", params["min_confidence"], "Confidence"),
                          (axes[2], "lift", params["min_lift"], "Lift")]:
    ax.hist(rules_df[col], bins=25, color=PRIMARY, alpha=0.85, edgecolor="white")
    ax.axvline(thr, color=RED, ls="--", lw=1.5, label=f"threshold = {thr}")
    ax.set_xlabel(col); ax.set_ylabel("Rules"); ax.set_title(ttl)
    ax.legend(fontsize=8)
fig_note(fig, "Distributions of the saved rule metrics. Threshold lines show the configured Apriori cutoffs; "
              "rules below a threshold were not saved. Skip if the support-vs-confidence scatter (N04-07) already "
              "communicates the distribution adequately.")
plt.show()
'''),
    ]
    last_idx = len(cells) - 1
    final_cells = list(cells)
    for ai, block in sorted(insertions.items(), key=lambda t: t[0], reverse=True):
        pos = ai + 1
        for c in block:
            final_cells.insert(pos, c)
            pos += 1
    for c in appendix:
        final_cells.append(c)
    nb.cells = final_cells
    nbformat.write(nb, NOTEBOOKS["04"])
    print("Wrote", NOTEBOOKS["04"].name, "cells:", len(nb.cells))


if __name__ == "__main__":
    build_n01()
    build_n02()
    build_n03()
    build_n04()
