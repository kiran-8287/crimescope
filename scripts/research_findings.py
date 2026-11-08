"""CrimeScope research findings generator.

One clear entry point for the five documented investigations. Reads ONLY the
current immutable release + saved analysis run artifacts; never refits production
models and never overwrites the run directory.

Usage:
    python scripts/research_findings.py [--out <dir>]

Outputs (default analysis/output/findings/<run_id>/):
    findings.json            machine-readable results for every investigation
    tables/*.csv             tabular evidence
    figures/*.png            readable charts

Conventions used by the saved pipeline (do not mix them):
  * PCA / K-means feature scaling: log1p then z-score with POPULATION std (ddof=0)
    (analysis/src/crimescope_analysis/features/matrix.py, methods/pca.py).
  * Anomaly z-scores: cross-sectional (value - mean) / SAMPLE std (ddof=1)
    (analysis/src/crimescope_analysis/methods/anomaly.py).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]

SERVING_POINTER = ROOT / "data/serving/current.json"
RUNS_POINTER = ROOT / "analysis/output/runs/current.json"
HIERARCHY_PATH = ROOT / "config/category_hierarchy.json"

LOG1P_Z_CAVEAT = (
    "PCA and K-means transform features as log1p(x) then z-score with population "
    "std (ddof=0); anomaly z-scores use sample std (ddof=1)."
)

# Every saved analysis-run artifact this script parses. Each is checked against its
# recorded sha256 in the run manifest's `artifacts` map before any parsing happens.
CONSUMED_ARTIFACTS = (
    "pca/pca_2024.json",
    "kmeans/kmeans_2024_k3.json",
    "kmeans/kmeans_2024_k4.json",
    "kmeans/kmeans_2024_k5.json",
    "anomalies/anomalies_2024.json",
    "association/association_rules_2024.json",
)


# --------------------------------------------------------------------------- #
# small utilities
# --------------------------------------------------------------------------- #
def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_artifact_hash(manifest: dict, run_dir: Path, rel_path: str) -> tuple[bool, str]:
    """Check one consumed run artifact against its recorded manifest sha256.

    Returns (ok, detail). Fails closed (ok = False) when the manifest records no
    hash for the artifact, so an unrecorded artifact is never trusted. `detail`
    always names the artifact and both short hashes for a useful failure message.
    """
    recorded = (manifest.get("artifacts") or {}).get(rel_path)
    if recorded is None:
        return False, f"{rel_path}: no recorded hash in run manifest"
    actual = sha256_file(run_dir / rel_path)
    ok = actual == recorded
    return ok, f"{rel_path}: recorded {recorded[:12]}… actual {actual[:12]}…"


def clean_category_name(raw: str) -> str:
    if not raw:
        return ""
    c = raw
    c = re.sub(r"^[a-z0-9]\)\s*", "", c, flags=re.I)
    c = re.sub(r"^[A-Z]\.\s*", "", c)
    c = c.strip()
    c = re.sub(r"\s*\([^)]*BNS[^)]*\)", "", c, flags=re.I)
    c = re.sub(r"\s*\([^)]*IPC[^)]*\)", "", c, flags=re.I)
    c = re.sub(r"\s*\([^)]*Sec[^)]*\)", "", c, flags=re.I)
    c = re.sub(r"\s*BNS\)?", "", c, flags=re.I)
    c = re.sub(r"\s*/[0-9/A-Z\s]+BNS/IPC\)?", "", c, flags=re.I)
    c = re.sub(r"\s*/Section\s*[0-9A-Z\s/]+IPC\)?", "", c, flags=re.I)
    c = re.sub(r"\s*/[0-9]+\s*IPC\)?", "", c, flags=re.I)
    c = re.sub(r"\s*/\s*$", "", c)
    return c.strip() or raw


def _first_header(cat: dict, year: int) -> str | None:
    headers = cat.get("sourceHeaders") or {}
    if not headers:
        return None
    if str(year) in headers and headers[str(year)]:
        return headers[str(year)][0]
    for value in headers.values():
        if value:
            return value[0]
    return None


def context_label(cat_by_id: dict, cid: str | None, year: int) -> str:
    if not cid or cid not in cat_by_id:
        return ""
    cat = cat_by_id[cid]
    header = _first_header(cat, year)
    if not header:
        return clean_category_name(cat.get("label", cid))
    parts = [p.strip() for p in header.split(" | ") if p.strip()]
    if len(parts) < 2:
        return clean_category_name(cat.get("label", "")) or cid
    leaf = clean_category_name(parts[-1])
    parent = clean_category_name(parts[-2]) or parts[-2]
    if not leaf:
        return parent
    if not parent or parent.lower() == leaf.lower():
        return leaf
    return f"{parent} › {leaf}"


def hierarchy_parents(cat_by_id: dict, cid: str, year: int) -> list[str]:
    if cid not in cat_by_id:
        return []
    header = _first_header(cat_by_id[cid], year)
    if not header:
        return []
    return [clean_category_name(p) for p in header.split(" | ") if p.strip()]


def is_ancestor(cat_by_id: dict, ancestor_id: str, descendant_id: str, year: int) -> bool:
    if ancestor_id == descendant_id:
        return True
    ap = hierarchy_parents(cat_by_id, ancestor_id, year)
    dp = hierarchy_parents(cat_by_id, descendant_id, year)
    if not ap or not dp or len(ap) >= len(dp):
        return False
    return dp[: len(ap)] == ap


# --------------------------------------------------------------------------- #
# load pointers + verify hashes
# --------------------------------------------------------------------------- #
def load_context() -> dict:
    serving = load_json(SERVING_POINTER)
    run_pointer = load_json(RUNS_POINTER)
    manifest_path = ROOT / run_pointer["manifest"]
    manifest = load_json(manifest_path)
    run_dir = manifest_path.parent

    release_dir = ROOT / serving["release_path"]
    release_manifest = load_json(release_dir / "release_manifest.json")
    sqlite_path = ROOT / serving["sqlite_path"]

    feature_path = run_dir / "feature_input.csv"
    checks = {
        "sqlite_matches_manifest": sha256_file(sqlite_path) == release_manifest["sqlite"]["sha256"],
        "feature_input_matches_manifest": sha256_file(feature_path) == manifest["feature_input"]["sha256"],
        "release_dataset_matches_run":
            release_manifest["source_dataset"]["sha256"] == manifest["dataset"]["sha256"],
    }

    # Verify every consumed run artifact against its recorded manifest hash before
    # any investigation parses it. Fails closed, naming the artifact and mismatch.
    artifact_details: dict[str, str] = {}
    for rel_path in CONSUMED_ARTIFACTS:
        ok, detail = verify_artifact_hash(manifest, run_dir, rel_path)
        checks[f"artifact::{rel_path}"] = ok
        artifact_details[rel_path] = detail

    if not all(checks.values()):
        failed = {k: v for k, v in checks.items() if not v}
        detail = "; ".join(artifact_details[k.split("::", 1)[1]] for k in failed if "::" in k)
        raise SystemExit(f"Hash verification failed: {failed}" + (f" — {detail}" if detail else ""))

    return {
        "serving": serving,
        "run_pointer": run_pointer,
        "manifest": manifest,
        "manifest_path": manifest_path,
        "run_dir": run_dir,
        "release_dir": release_dir,
        "release_manifest": release_manifest,
        "sqlite_path": sqlite_path,
        "feature_path": feature_path,
        "checks": checks,
        "artifact_details": artifact_details,
    }


def load_hierarchy() -> tuple[dict, dict]:
    data = load_json(HIERARCHY_PATH)
    by_id = {c["id"]: c for c in data["categories"]}
    return data, by_id


def official_total_id(by_id: dict, year: int) -> str | None:
    for cid, cat in by_id.items():
        if str(year) in (cat.get("rolesByYear") or {}) and "official_total" in cat["rolesByYear"][str(year)]:
            return cid
    return None


def load_feature_rows(feature_path: Path) -> tuple[list[dict], list[str], dict]:
    """Return rows, ordered region ids, and per-region category->value map."""
    rows: list[dict] = []
    region_ids: list[str] = []
    seen = set()
    with feature_path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            row["total"] = int(row["total"]) if row.get("total") not in (None, "") else 0
            row["year"] = int(row["year"])
            rows.append(row)
            rid = row["region_id"]
            if rid not in seen:
                seen.add(rid)
                region_ids.append(rid)
    return rows, region_ids, {}


# --------------------------------------------------------------------------- #
# Investigation 1 - reporting volume & PCA
# --------------------------------------------------------------------------- #
def investigation_1(ctx: dict, by_id: dict, feat_rows: list[dict], out_dir: Path) -> dict:
    pca = load_json(ctx["run_dir"] / "pca/pca_2024.json")
    evr = pca["explained_variance_ratio"]
    cum = pca["cumulative_variance_ratio"]
    eigenvalues = pca["eigenvalues"]

    # official 2024 total per district straight from the release
    total_id = official_total_id(by_id, 2024)
    con = sqlite3.connect(str(ctx["sqlite_path"]))
    totals = {gid: val for gid, val in con.execute(
        "SELECT geography_id, reported_value FROM crime_observations "
        "WHERE year=2024 AND category_id=? AND region_type='administrative_district' AND measure_type='cases'",
        (total_id,),
    )}
    con.close()

    rows = []
    unmatched = 0
    for comp in pca["components"]:
        rid = comp["region_id"]
        if rid not in totals or totals[rid] is None:
            unmatched += 1
            continue
        score = {s["component"]: s["score"] for s in comp["scores"]}
        rows.append({"region_id": rid, "region": comp["region"], "pc1": score["PC1"],
                     "pc2": score["PC2"], "total": totals[rid]})

    vol = np.array([r["total"] for r in rows], dtype=float)
    pc1 = np.array([r["pc1"] for r in rows], dtype=float)
    pc2 = np.array([r["pc2"] for r in rows], dtype=float)
    logvol = np.log1p(vol)

    r_pc1_log = float(np.corrcoef(logvol, pc1)[0, 1]) if len(rows) > 2 else None
    r_pc1_raw = float(np.corrcoef(vol, pc1)[0, 1]) if len(rows) > 2 else None
    r_pc2_log = float(np.corrcoef(logvol, pc2)[0, 1]) if len(rows) > 2 else None

    pc1_load = next(l for l in pca["loadings"] if l["component"] == "PC1")
    pc2_load = next(l for l in pca["loadings"] if l["component"] == "PC2")
    feats1 = sorted(pc1_load["features"], key=lambda f: f["loading"], reverse=True)
    feats2 = sorted(pc2_load["features"], key=lambda f: f["loading"], reverse=True)

    def label_feature(f):
        return {"category": f["category"], "id": f["id"],
                "context": context_label(by_id, f["id"], 2024), "loading": round(f["loading"], 4)}

    result = {
        "n_pca_regions": pca["n_regions"],
        "n_pca_features": pca["n_categories"],
        "n_joined_observations": len(rows),
        "n_unmatched": unmatched,
        "explained_variance_pc1": round(evr[0], 6),
        "explained_variance_pc2": round(evr[1], 6),
        "cumulative_variance_pc1_pc2": round(cum[1], 6),
        "eigenvalues": [round(e, 6) for e in eigenvalues],
        "total_feature_variance": round(pca["total_feature_variance"], 6),
        "spearman_note": "correlations are Pearson on the stated variable; PCA signs are arbitrary",
        "corr_pc1_log1p_total": round(r_pc1_log, 4),
        "corr_pc1_raw_total": round(r_pc1_raw, 4),
        "corr_pc2_log1p_total": round(r_pc2_log, 4),
        "pc1_top_positive_loadings": [label_feature(f) for f in feats1[:5]],
        "pc1_top_negative_loadings": [label_feature(f) for f in feats1[-5:][::-1]],
        "pc2_top_positive_loadings": [label_feature(f) for f in feats2[:5]],
        "pc2_top_negative_loadings": [label_feature(f) for f in feats2[-5:][::-1]],
    }

    # figure: PC1 vs log1p(total)
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    axes[0].scatter(logvol, pc1, s=14, alpha=0.5, color="#0f766e")
    axes[0].set_xlabel("log1p(official 2024 reported total)")
    axes[0].set_ylabel("PC1 score")
    axes[0].set_title(f"PC1 vs log1p(total)   r = {r_pc1_log:.2f}")
    axes[0].grid(alpha=0.25)
    x = np.linspace(logvol.min(), logvol.max(), 50)
    m, b = np.polyfit(logvol, pc1, 1)
    axes[0].plot(x, m * x + b, color="#b91c1c", lw=2)

    # Explained-variance bars. The denominator is the TOTAL feature variance (all
    # 131 dimensions), so each bar is that component's share of the whole feature
    # space -- not a share of the two saved components. Only PC1 and PC2 are saved,
    # so the remainder (PC3..PC131) is reported as one residual bar; this is NOT a
    # full scree plot (which would need every eigenvalue) and no eigenvalue is
    # invented or refitted here.
    total_var = float(pca["total_feature_variance"])
    pc1_share = eigenvalues[0] / total_var
    pc2_share = eigenvalues[1] / total_var
    remaining_share = 1.0 - pc1_share - pc2_share
    shares = [pc1_share, pc2_share, remaining_share]
    axes[1].bar([0, 1, 2], shares, color=["#0f766e", "#2563eb", "#94a3b8"])
    axes[1].set_xticks([0, 1, 2])
    axes[1].set_xticklabels(["PC1", "PC2", "PC3–PC131\n(remaining)"], fontsize=9)
    axes[1].set_ylabel("share of total feature variance")
    axes[1].set_title(
        f"PC1 {pc1_share*100:.2f}% · PC2 {pc2_share*100:.2f}% · "
        f"remaining {remaining_share*100:.2f}%"
    )
    for i, v in enumerate(shares):
        axes[1].text(i, v + 0.012, f"{v*100:.2f}%", ha="center", fontsize=8)
    fig.suptitle("Inv 1: PCA volume axis (log1p + z-score, ddof=0)", fontsize=11)
    fig.tight_layout()
    fig.savefig(out_dir / "figures/inv1_pca_volume.png", dpi=130)
    plt.close(fig)

    return result


# --------------------------------------------------------------------------- #
# Investigation 2 - annual totals vs matched-unit change
# --------------------------------------------------------------------------- #
def investigation_2(ctx: dict, by_id: dict, out_dir: Path) -> dict:
    con = sqlite3.connect(str(ctx["sqlite_path"]))
    per_year = {}
    for year in ctx["release_manifest"]["years"]:
        cid = official_total_id(by_id, year)
        rows = list(con.execute(
            "SELECT state_name, region_name, geography_id, reported_value FROM crime_observations "
            "WHERE year=? AND category_id=? AND region_type='administrative_district' AND measure_type='cases'",
            (year, cid),
        ))
        per_year[year] = {(st, rn): {"geography_id": gid, "value": val} for st, rn, gid, val in rows}
    con.close()

    annual_totals = {str(y): int(sum(v["value"] for v in d.values())) for y, d in per_year.items()}
    annual_counts = {str(y): len(d) for y, d in per_year.items()}

    # operational name match on (state, region) between the only source-connected pair 2022-2023
    a, b = per_year[2022], per_year[2023]
    matched_keys = set(a) & set(b)
    matched_2022 = sum(a[k]["value"] for k in matched_keys)
    matched_2023 = sum(b[k]["value"] for k in matched_keys)
    excluded_2022 = [(k, a[k]["value"]) for k in a if k not in matched_keys]
    excluded_2023 = [(k, b[k]["value"]) for k in b if k not in matched_keys]

    def pct(cur, base):
        return None if not base else round((cur - base) / base * 100, 2)

    result = {
        "annual_totals": annual_totals,
        "annual_admin_district_counts": annual_counts,
        "annual_abs_change_2023_vs_2022": annual_totals["2023"] - annual_totals["2022"],
        "annual_pct_change_2023_vs_2022": pct(annual_totals["2023"], annual_totals["2022"]),
        "matched_pair": [2022, 2023],
        "matched_unit_count": len(matched_keys),
        "matched_total_2022": int(matched_2022),
        "matched_total_2023": int(matched_2023),
        "matched_abs_change": int(matched_2023 - matched_2022),
        "matched_pct_change": pct(matched_2023, matched_2022),
        "excluded_2022_count": len(excluded_2022),
        "excluded_2023_count": len(excluded_2023),
        "excluded_2022_total": int(sum(v for _, v in excluded_2022)),
        "excluded_2023_total": int(sum(v for _, v in excluded_2023)),
        "reconcile_2022": annual_totals["2022"] == int(matched_2022) + int(sum(v for _, v in excluded_2022)),
        "reconcile_2023": annual_totals["2023"] == int(matched_2023) + int(sum(v for _, v in excluded_2023)),
        "excluded_2022_units": sorted(f"{st} · {rn}" for (st, rn), _ in excluded_2022),
        "excluded_2023_units": sorted(f"{st} · {rn}" for (st, rn), _ in excluded_2023),
        "note": "Name matching is an operational join; it is NOT evidence of administrative-boundary continuity.",
    }

    # figure
    years = [y for y in ctx["release_manifest"]["years"]]
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.plot([str(y) for y in years], [annual_totals[str(y)] for y in years],
            marker="o", lw=2, label="Annual total (all 2024-eligible admin districts)")
    ax.scatter(["2022", "2023"], [matched_2022, matched_2023], color="#b91c1c", zorder=5, s=70,
               label=f"Matched 2022–2023 cohort (n={len(matched_keys)})")
    ax.plot(["2022", "2023"], [matched_2022, matched_2023], color="#b91c1c", lw=2, ls="--")
    for i, y in enumerate(years):
        ax.annotate(f"{annual_totals[str(y)]:,}", (str(y), annual_totals[str(y)]),
                    textcoords="offset points", xytext=(0, 9), ha="center", fontsize=8)
    ax.annotate(f"{matched_2022:,}", ("2022", matched_2022), textcoords="offset points",
                xytext=(0, -16), ha="center", fontsize=8, color="#b91c1c")
    ax.annotate(f"{matched_2023:,}", ("2023", matched_2023), textcoords="offset points",
                xytext=(0, -16), ha="center", fontsize=8, color="#b91c1c")
    ax.set_title("Inv 2: Annual official totals vs the matched 2022–2023 cohort")
    ax.set_ylabel("official reported cases (admin districts)")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_dir / "figures/inv2_annual_vs_matched.png", dpi=130)
    plt.close(fig)

    return result


# --------------------------------------------------------------------------- #
# shared: transformed feature space reproduction
# --------------------------------------------------------------------------- #
def reproduce_transformed_matrix(feat_rows: list[dict], year: int = 2024):
    """Return (region_ids, categories, raw matrix, transformed matrix).

    Reproduces the pipeline transform: log1p then z-score with population std (ddof=0).
    """
    regions = sorted({r["region_id"] for r in feat_rows if r["year"] == year})
    categories = sorted({r["category"] for r in feat_rows if r["year"] == year})
    cat_index = {c: j for j, c in enumerate(categories)}
    reg_index = {r: i for i, r in enumerate(regions)}
    raw = np.zeros((len(regions), len(categories)), dtype=float)
    for row in feat_rows:
        if row["year"] != year:
            continue
        raw[reg_index[row["region_id"]], cat_index[row["category"]]] = row["total"]
    logged = np.log1p(np.maximum(raw, 0.0))
    means = logged.mean(axis=0)
    scales = logged.std(axis=0, ddof=0)
    scales[scales == 0] = 1.0
    transformed = (logged - means) / scales
    return regions, categories, raw, transformed


# --------------------------------------------------------------------------- #
# Investigation 3 - what distinguishes the clusters
# --------------------------------------------------------------------------- #
def investigation_3(ctx: dict, by_id: dict, feat_rows: list[dict], out_dir: Path) -> dict:
    regions, categories, raw, transformed = reproduce_transformed_matrix(feat_rows, 2024)
    reg_index = {r: i for i, r in enumerate(regions)}

    total_id = official_total_id(by_id, 2024)
    con = sqlite3.connect(str(ctx["sqlite_path"]))
    totals = {gid: val for gid, val in con.execute(
        "SELECT geography_id, reported_value FROM crime_observations "
        "WHERE year=2024 AND category_id=? AND region_type='administrative_district' AND measure_type='cases'",
        (total_id,))}
    con.close()

    km = load_json(ctx["run_dir"] / "kmeans/kmeans_2024_k3.json")
    assign = {rec["region_id"]: rec["cluster_id"] for rec in km["assignment_records"]}
    label_of = {rec["region_id"]: rec["region"] for rec in km["assignment_records"]}

    clusters = {}
    for cid in range(km["k"]):
        members = [rid for rid in regions if assign.get(rid) == cid]
        idx = [reg_index[r] for r in members]
        member_totals = [totals.get(r, 0) for r in members]
        centroid = transformed[idx].mean(axis=0)
        # representative = member nearest its cluster centroid in fitted space
        dists = np.linalg.norm(transformed[idx] - centroid, axis=1)
        order = np.argsort(dists)
        reps = [{"region_id": members[i], "region": label_of.get(members[i], members[i]),
                 "distance_to_centroid": round(float(dists[i]), 4)} for i in order[:5]]
        top_pos = np.argsort(centroid)[::-1][:5]
        top_neg = np.argsort(centroid)[:5]
        clusters[cid] = {
            "cluster": cid + 1,
            "size": len(members),
            "total_cases_sum": int(sum(member_totals)),
            "total_cases_median": float(np.median(member_totals)) if member_totals else None,
            "total_cases_iqr": [float(np.percentile(member_totals, 25)), float(np.percentile(member_totals, 75))] if member_totals else None,
            "representative_units": reps,
            "distinctive_high_features": [
                {"category": categories[j], "context": context_label(by_id, _cat_id(by_id, categories[j]), 2024),
                 "centroid_z": round(float(centroid[j]), 3)} for j in top_pos],
            "distinctive_low_features": [
                {"category": categories[j], "context": context_label(by_id, _cat_id(by_id, categories[j]), 2024),
                 "centroid_z": round(float(centroid[j]), 3)} for j in top_neg],
        }

    diagnostics = []
    for k in (3, 4, 5):
        kmk = load_json(ctx["run_dir"] / f"kmeans/kmeans_2024_k{k}.json")
        diagnostics.append({"k": k, "inertia": kmk["inertia"], "cluster_sizes": kmk["cluster_sizes"]})

    result = {
        "primary_k": 3,
        "k3_cluster_sizes": km["cluster_sizes"],
        "k3_seed": km["seed"],
        "k3_inertia": km["inertia"],
        "clusters": clusters,
        "k_diagnostics": diagnostics,
        "caveat": ("Inertia falls mechanically as k rises; it is not a goodness-of-fit score, so no "
                   "optimal k is declared. Clusters describe profile similarity, not safety, risk or rurality. "
                   + LOG1P_Z_CAVEAT),
        "deviation_reference": "centroids are means of members in z-scored transformed space; 0 = national average",
    }

    # figure: per-cluster official total distribution
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    data_by_cluster = [[totals.get(r, 0) for r in regions if assign.get(r) == c] for c in range(km["k"])]
    axes[0].boxplot(data_by_cluster, tick_labels=[f"C{c+1}" for c in range(km["k"])], showfliers=False)
    for c, vals in enumerate(data_by_cluster):
        axes[0].scatter([c + 1] * len(vals), vals, alpha=0.25, s=8, color="#0f766e")
    axes[0].set_ylabel("official 2024 reported total")
    axes[0].set_title("Official total by k=3 cluster")
    axes[0].grid(alpha=0.25, axis="y")

    ks = [d["k"] for d in diagnostics]
    axes[1].plot(ks, [d["inertia"] for d in diagnostics], marker="o", color="#b91c1c")
    for d in diagnostics:
        axes[1].annotate(f"{d['inertia']:.0f}", (d["k"], d["inertia"]), textcoords="offset points",
                         xytext=(0, 8), ha="center", fontsize=8)
    axes[1].set_xlabel("k"); axes[1].set_ylabel("inertia")
    axes[1].set_title("Inertia by k (falls mechanically; not a fit score)")
    axes[1].grid(alpha=0.25)
    fig.suptitle("Inv 3: k=3 cluster profiles (log1p + z-score, ddof=0)", fontsize=11)
    fig.tight_layout()
    fig.savefig(out_dir / "figures/inv3_cluster_totals.png", dpi=130)
    plt.close(fig)
    return result


def _cat_id(by_id: dict, label: str) -> str | None:
    for cid, cat in by_id.items():
        if cat.get("label") == label:
            return cid
    return None


# --------------------------------------------------------------------------- #
# Investigation 4 - rare-category and high-volume flags
# --------------------------------------------------------------------------- #
def investigation_4(ctx: dict, by_id: dict, feat_rows: list[dict], out_dir: Path) -> dict:
    anom = load_json(ctx["run_dir"] / "anomalies/anomalies_2024.json")
    cs = anom["cross_sectional"]

    # transparent selection: highest |z| small-count flag (rare) and largest-value flag (volume)
    rare = max(cs, key=lambda a: (abs(a["z_score"]), ))
    high = max(cs, key=lambda a: (a["value"], abs(a["z_score"])))

    # category distribution across the 2024 administrative-district cohort from the feature matrix
    regions, categories, raw, _ = reproduce_transformed_matrix(feat_rows, 2024)
    reg_index = {r: i for i, r in enumerate(regions)}
    cat_index = {c: j for j, c in enumerate(categories)}

    def profile(flag: dict) -> dict:
        cat = flag["category"]
        j = cat_index[cat]
        values = raw[:, j]
        n = len(values)
        zeros = int(np.sum(values == 0))
        mean = float(values.mean())
        std_saved = float(np.std(values, ddof=1))  # anomaly.py convention
        observed = int(flag["value"])
        repro = (observed - mean) / std_saved if std_saved else None
        # validate the saved z equals the reproduction within rounding of saved mean/std
        saved_mean = flag["category_mean"]
        saved_std = flag["category_std"]
        saved_z = flag["z_score"]
        repro_from_saved = (observed - saved_mean) / saved_std if saved_std else None
        return {
            "category": cat,
            "category_id": _cat_id(by_id, cat),
            "context": context_label(by_id, _cat_id(by_id, cat), 2024),
            "reporting_unit": flag["region"],
            "reporting_unit_id": flag.get("region_id"),
            "state": flag["state_name"],
            "observed_value": observed,
            "population_size": n,
            "zero_count": zeros,
            "zero_fraction": round(zeros / n, 4),
            "mean": round(mean, 6),
            "std_sample_ddof1": round(std_saved, 6),
            "reproduced_z": round(repro, 4) if repro is not None else None,
            "saved_z": saved_z,
            "saved_mean": saved_mean,
            "saved_std": saved_std,
            "reproduced_z_from_saved": round(repro_from_saved, 4) if repro_from_saved is not None else None,
            "definition": "(observed_value - cohort_mean) / cohort_std, cohort_std = sample std (ddof=1)",
        }

    rare_p = profile(rare)
    high_p = profile(high)

    result = {
        "selection_rule": {
            "rare_category": "cross-sectional flag with the largest |z| among saved flags",
            "high_volume": "cross-sectional flag with the largest observed value among saved flags",
            "threshold": "|z| >= 2.5 saved cross-sectional flags only",
        },
        "rare_category_example": rare_p,
        "high_volume_example": high_p,
        "caveat": ("A statistical flag is not a data error, not wrongdoing and not a risk score; it says the value is "
                   "unusual relative to the same category elsewhere in 2024. For a single positive case among N-1 "
                   "zeros the sample-std z reduces to (N-1)/sqrt(N)."),
    }

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    for ax, p, color, title in (
        (axes[0], rare_p, "#b45309", "Rare-category flag"),
        (axes[1], high_p, "#0f766e", "High-volume flag"),
    ):
        values = raw[:, cat_index[p["category"]]]
        ax.hist(np.log1p(values), bins=40, color=color, alpha=0.7)
        ax.axvline(np.log1p(p["observed_value"]), color="#b91c1c", lw=2,
                   label=f"observed={p['observed_value']} (z={p['saved_z']})")
        ax.axvline(np.log1p(p["mean"]), color="#111827", lw=1, ls="--", label=f"cohort mean={p['mean']:.3f}")
        ax.set_title(f"{title}\n{p['context'][:52]}")
        ax.set_xlabel("log1p(cases) across 774 districts")
        ax.set_ylabel("districts")
        ax.legend(fontsize=8)
        ax.grid(alpha=0.25)
    fig.suptitle("Inv 4: reference distributions (sample std, ddof=1)", fontsize=11)
    fig.tight_layout()
    fig.savefig(out_dir / "figures/inv4_flags.png", dpi=130)
    plt.close(fig)
    return result


# --------------------------------------------------------------------------- #
# Investigation 5 - interpretable association rules
# --------------------------------------------------------------------------- #
def investigation_5(ctx: dict, by_id: dict, feat_rows: list[dict], out_dir: Path) -> dict:
    art = load_json(ctx["run_dir"] / "association/association_rules_2024.json")
    rules = art["rules"]
    N_saved = art["n_transactions"]

    manifest = ctx["manifest"]
    label_to_id = {f["label"]: f["id"] for f in manifest["feature_input"]["ordered_features"]}

    # rebuild the binary transaction population: item present at >= 10 cases
    region_items: dict[str, set] = defaultdict(set)
    for row in feat_rows:
        if row["total"] >= 10:
            region_items[row["region_id"]].add(row["category"])
    txns = [frozenset(items) for items in region_items.values() if items]
    N = len(txns)

    item_count = Counter()
    for t in txns:
        for item in t:
            item_count[item] += 1

    def single(rule_list):
        return len(rule_list) == 1

    # transparent selection: single-item antecedent AND consequent, top lift,
    # excluding ancestor/descendant (tautological) pairs
    candidates = []
    for rule in rules:
        if not (single(rule["antecedent"]) and single(rule["consequent"])):
            continue
        a, c = rule["antecedent"][0], rule["consequent"][0]
        aid, cid = label_to_id.get(a), label_to_id.get(c)
        if aid and cid and (is_ancestor(by_id, aid, cid, 2024) or is_ancestor(by_id, cid, aid, 2024)):
            continue
        candidates.append(rule)
    candidates.sort(key=lambda r: r["lift"], reverse=True)
    selected = candidates[:3]

    def detail(rule) -> dict:
        a, c = rule["antecedent"][0], rule["consequent"][0]
        ant, con = frozenset([a]), frozenset([c])
        ac = sum(1 for t in txns if ant <= t)
        cc = sum(1 for t in txns if con <= t)
        jc = sum(1 for t in txns if ant <= t and con <= t)
        supp = jc / N
        conf = jc / ac if ac else None
        lift = (jc * N) / (ac * cc) if ac and cc else None
        aid, cid = label_to_id.get(a), label_to_id.get(c)
        return {
            "antecedent_source_label": a,
            "antecedent_id": aid,
            "antecedent_context": context_label(by_id, aid, 2024),
            "consequent_source_label": c,
            "consequent_id": cid,
            "consequent_context": context_label(by_id, cid, 2024),
            "population": N,
            "antecedent_count": ac,
            "consequent_count": cc,
            "joint_count": jc,
            "support": round(supp, 4),
            "confidence": round(conf, 4) if conf is not None else None,
            "lift": round(lift, 4) if lift is not None else None,
            "saved_support": rule["support"],
            "saved_confidence": rule["confidence"],
            "saved_lift": rule["lift"],
            "consequent_baseline_prevalence": round(cc / N, 4),
        }

    selected_detail = [detail(r) for r in selected]
    result = {
        "n_transactions_saved": N_saved,
        "n_transactions_rebuilt": N,
        "n_rules_saved": len(rules),
        "item_present_threshold": "reported count >= 10 in a district",
        "empty_transaction_handling": "districts with no item >= 10 are dropped; they are not in the 739 population",
        "selection_rule": "single-item antecedent and consequent, highest lift, excluding ancestor/descendant pairs",
        "rules": selected_detail,
        "caveat": ("Association rules describe category co-occurrence across districts; they do not imply shared "
                   "incidents, shared offenders, or causation. Baseline prevalence = consequent support in the "
                   "transaction population."),
    }

    # figure: baseline vs conditional prevalence
    fig, ax = plt.subplots(figsize=(10, 5))
    labels = [f"R{i+1}" for i in range(len(selected_detail))]
    base = [r["consequent_baseline_prevalence"] for r in selected_detail]
    cond = [r["confidence"] for r in selected_detail]
    xpos = np.arange(len(labels))
    ax.bar(xpos - 0.2, base, width=0.4, label="baseline P(consequent)", color="#94a3b8")
    ax.bar(xpos + 0.2, cond, width=0.4, label="conditional P(consequent|antecedent)", color="#0f766e")
    for i, r in enumerate(selected_detail):
        ax.text(i, max(base[i], cond[i]) + 0.01, f"lift {r['lift']:.2f}×", ha="center", fontsize=8)
    ax.set_xticks(xpos); ax.set_xticklabels(labels)
    ax.set_ylabel("prevalence")
    ax.set_title("Inv 5: consequent baseline vs conditional prevalence (N=%d transactions)" % N)
    ax.legend(fontsize=8)
    ax.grid(alpha=0.25, axis="y")
    fig.tight_layout()
    fig.savefig(out_dir / "figures/inv5_rule_baselines.png", dpi=130)
    plt.close(fig)
    return result


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def write_tables(out_dir: Path, findings: dict) -> None:
    tables = out_dir / "tables"

    def dump(name, rows, header):
        with (tables / name).open("w", newline="", encoding="utf-8") as handle:
            w = csv.writer(handle)
            w.writerow(header)
            w.writerows(rows)

    inv2 = findings["investigation_2"]
    dump("inv2_excluded_2022.csv", [[u] for u in inv2["excluded_2022_units"]], ["excluded_unit_2022"])
    dump("inv2_excluded_2023.csv", [[u] for u in inv2["excluded_2023_units"]], ["excluded_unit_2023"])

    inv3 = findings["investigation_3"]
    dump("inv3_clusters.csv",
         [[c["cluster"], c["size"], c["total_cases_sum"], c["total_cases_median"]] for c in inv3["clusters"].values()],
         ["cluster", "size", "total_cases_sum", "total_cases_median"])

    inv5 = findings["investigation_5"]
    dump("inv5_rules.csv",
         [[r["antecedent_context"], r["consequent_context"], r["antecedent_count"], r["consequent_count"],
           r["joint_count"], r["support"], r["confidence"], r["lift"], r["consequent_baseline_prevalence"]]
          for r in inv5["rules"]],
         ["antecedent", "consequent", "ant_count", "con_count", "joint_count", "support", "confidence",
          "lift", "baseline"])


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate CrimeScope research findings.")
    parser.add_argument("--out", default=None, help="output directory (default analysis/output/findings/<run_id>)")
    args = parser.parse_args()

    ctx = load_context()
    _, by_id = load_hierarchy()
    feat_rows, _region_ids, _ = load_feature_rows(ctx["feature_path"])

    run_id = ctx["manifest"]["run_id"]
    out_dir = Path(args.out) if args.out else ROOT / "analysis/output/findings" / run_id
    (out_dir / "figures").mkdir(parents=True, exist_ok=True)
    (out_dir / "tables").mkdir(parents=True, exist_ok=True)

    findings = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "release_id": ctx["serving"]["release_id"],
        "run_id": run_id,
        "dataset_sha256": ctx["release_manifest"]["source_dataset"]["sha256"],
        "checks": ctx["checks"],
        "conventions": {
            "feature_transform": "log1p then z-score, POPULATION std (ddof=0) for PCA/K-means",
            "anomaly_zscore": "cross-sectional (value - mean)/SAMPLE std (ddof=1)",
        },
        "investigation_1": investigation_1(ctx, by_id, feat_rows, out_dir),
        "investigation_2": investigation_2(ctx, by_id, out_dir),
        "investigation_3": investigation_3(ctx, by_id, feat_rows, out_dir),
        "investigation_4": investigation_4(ctx, by_id, feat_rows, out_dir),
        "investigation_5": investigation_5(ctx, by_id, feat_rows, out_dir),
    }

    write_tables(out_dir, findings)
    (out_dir / "findings.json").write_text(json.dumps(findings, indent=2), encoding="utf-8")

    print(json.dumps({
        "out_dir": str(out_dir.relative_to(ROOT)),
        "release_id": findings["release_id"],
        "run_id": run_id,
        "inv1_corr_pc1_log1p": findings["investigation_1"]["corr_pc1_log1p_total"],
        "inv2_annual": findings["investigation_2"]["annual_totals"],
        "inv2_matched_n": findings["investigation_2"]["matched_unit_count"],
        "inv4_rare_z": findings["investigation_4"]["rare_category_example"]["saved_z"],
        "inv5_selected_lifts": [r["lift"] for r in findings["investigation_5"]["rules"]],
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
