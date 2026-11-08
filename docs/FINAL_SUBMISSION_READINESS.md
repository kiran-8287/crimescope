# CrimeScope — Final Submission Readiness

**Date:** 2026-11-08
**Scope of this pass:** a **bounded final correction pass** over the existing
CrimeScope project. No project restart, no redesign, no new algorithms, no source
dataset rebuild, and no production-model refit.

**Verified active pointers (read from disk, not assumed):**

| Pointer | Value |
|---|---|
| `data/serving/current.json` → release | `ncrb-districtwise-2021-2024-ecec48b772bc` |
| `analysis/output/runs/current.json` → run | `ncrb-national-2024-admin-log1p-zscore-20261107-v4` |

These match the expected release/run. Pointers were **not** modified.

---

## 1. Corrections made (issue → correction → evidence)

| # | Issue | Correction | Evidence |
|---|---|---|---|
| 1 | Cluster narrative contradicted the saved artifact (claimed the "smallest cluster" carried elevated Stalking/Day Burglary / framed clusters as urban/unsafe, inertia as optimality, seed as stability) | Cluster sizes/counts come from the saved artifact (**C1 = 190**, **C2 = 168 = smallest**, **C3 = 416 = largest**); the elevated Stalking/Day Burglary profile is attributed to **C1**, not the smallest. Seed 42 is labelled *reproducibility metadata, not a stability measure*; inertia is explained as always falling with k (not a goodness-of-fit proof); clusters are described as similarity in profile space, **not** urban/rural or safe/unsafe | [ClustersPage.tsx](file:///a:/Projects/crimescope/frontend/src/features/ClustersPage.tsx#L78-L183) |
| 2 | "Matching removes the changing unit count" overstated the effect and implied boundary continuity | Replaced with: *"Restricting the comparison to the same named reporting units reduces the measured increase from 4.70 % to 3.15 %. This controls membership in the comparison set but does not establish unchanged reporting boundaries."* Exact values verified: 2022 annual **2,808,408**, 2023 **2,940,460**; matched **2,804,254 / 2,892,597** over **749** units; annual **+4.70 %**, matched **+3.15 %**. 2023–2024 stays disconnected (IPC→BNS) | [findings.md](file:///a:/Projects/crimescope/docs/findings.md#L133-L159), [demo_run_sheet.md](file:///a:/Projects/crimescope/docs/demo_run_sheet.md#L33-L38), [geography_and_category_comparability.md](file:///a:/Projects/crimescope/docs/geography_and_category_comparability.md#L27) |
| 3 | PCA figure percentages risked a wrong denominator / "scree plot" label | Explained-variance percentages are the share of **total feature variance** (PC1 **15.91 %**, PC2 **4.57 %**, combined **20.48 %**, remaining **≈ 79.52 %**). Because only two component values are saved, the figure shows PC1/PC2 + the remaining variance explicitly and is labelled a two-component share chart, **not** a full scree plot; no eigenvalues were invented and no refit ran. Dashboard wording is "**PCA score plot**" | [research_findings.py](file:///a:/Projects/crimescope/scripts/research_findings.py#L322-L336); figure `analysis/output/findings/<run_id>/figures/inv1_pca_volume.png` regenerated |
| 4 | Hash verification of consumed analysis artifacts was not documented precisely | Inspected exactly what the findings script validates: every consumed artifact in `CONSUMED_ARTIFACTS` is checked against its recorded manifest hash **before parsing** via `verify_artifact_hash`, failing closed with the filename on mismatch or on an unrecorded hash. A focused fixture-only test was added (valid passes; modified artifact rejected; unrecorded artifact fails closed; the consumed set equals the six parsed paths; the error names the artifact) | [research_findings.py](file:///a:/Projects/crimescope/scripts/research_findings.py), [test_research_findings_hashes.py](file:///a:/Projects/crimescope/analysis/tests/test_research_findings_hashes.py) |
| 5 | Verification claims conflated automated assertions with visual review | Distinctions documented: (a) automated browser assertions passing, (b) screenshot capture = **evidence generation**, (c) opening/inspecting screenshots = **visual review**. No image-viewing tool is available in this environment, so **visual review is marked pending** with the exact files listed; no visual verification is claimed | [SCOPE_2021_2024_VERIFICATION.md](file:///a:/Projects/crimescope/docs/SCOPE_2021_2024_VERIFICATION.md), [STATUS.md](file:///a:/Projects/crimescope/progress/STATUS.md), [demo_run_sheet.md](file:///a:/Projects/crimescope/docs/demo_run_sheet.md#L80-L134) |
| 6 | Demo sheet referenced a non-existent `data/verification/demo_*/` path | Updated to reference the **actual** captures (`phase4_1794091462523/`, `scope_2021_2024_reverify_20261107_2354/`, `demo_walkthrough_1794132696085/`), mapped each step to a real file, marked steps covered only by earlier captures, used research figures as **supplementary** evidence (not falsely labelled dashboard screenshots), removed "committed figures", and added an evidence index. The fallback works without a live backend | [demo_run_sheet.md](file:///a:/Projects/crimescope/docs/demo_run_sheet.md#L80-L134) |
| 7 | Documentation ambiguities, "Pending." placeholders, wording implying verified boundaries / zero-null completeness / hash = interpretation / fixed init = robustness | (A) Ambiguous abbreviations expanded, e.g. "A.P. · Kurung Kumey" → `Arunachal Pradesh · Kurung Kumey`. (B) "Pending." placeholders replaced with grounded content in `cleaning_decisions.md` and `geography_and_category_comparability.md`. (C) "category profile" wording used; claims implying verified boundaries, zero-null completeness, that hash checks prove interpretation, that a fixed init proves robustness, or that all backend methods are active were removed. (D) Markdown links/paths validated. (E) Tested environment documented accurately: tested (`Node v24.15.0`, `npm 11.6.1`, `Python 3.14.5`) vs declared-only (engines `Node ≥ 18`, `npm ≥ 9`; `requires-python = ">=3.10"`) | [reproducibility.md](file:///a:/Projects/crimescope/docs/reproducibility.md), [deployment.md](file:///a:/Projects/crimescope/docs/deployment.md), [findings.md](file:///a:/Projects/crimescope/docs/findings.md#L204) |
| 8 | Genuinely ambiguous categories could be shown without an honest context marker | A leaf whose verified parent metadata is unavailable keeps its **stable id + original label** and shows a concise "**Parent context unavailable**" indication; exports include a `category_context_status` field (`hierarchical` / `top_level` / `unavailable`). Legitimate top-level categories are **not** marked unresolved; no hierarchy is fabricated | [categories.ts](file:///a:/Projects/crimescope/frontend/src/utils/categories.ts#L55-L71), [OverviewPage.tsx](file:///a:/Projects/crimescope/frontend/src/features/OverviewPage.tsx#L120) |
| 9 | Demo needed an ordered rehearsal with separately measured timing | `verify_demo_walkthrough.js` follows the run sheet steps 1–9 **in order** in an isolated context, asserting each expected value against the DOM → **37/37 checks passed, automated 35.7 s** (machine wall-clock, excludes human speaking time) | [summary.json](file:///a:/Projects/crimescope/data/verification/demo_walkthrough_1794132696085/summary.json) |

---

## 2. Verified release / run

- Release `ncrb-districtwise-2021-2024-ecec48b772bc` — 567,078 canonical rows
  (546,198 eligible + 20,880 aggregate), 144 source files, years 2021–2024, 0 nulls.
- Run `ncrb-national-2024-admin-log1p-zscore-20261107-v4` — 774 × 131 feature cohort
  (2024 only); PCA PC1 15.91 % / PC2 4.57 % (cum 20.48 %); k=3 sizes 190/168/416;
  739 transactions → 697 association rules.

---

## 3. Commands executed + outcomes

| Command | Outcome |
|---|---|
| `backend: npm run test` (Vitest) | 13 passed / 3 files, exit 0 |
| `frontend: npm test` (`node --test`) | 18 passed |
| `python -m pytest analysis/tests scripts/test_refined_classifier.py` | 19 passed |
| `backend: npm run build` (`tsc`) | PASS |
| `frontend: npm run build` (`tsc --noEmit && vite build`) | PASS |
| `python scripts/research_findings.py` | Regenerated `findings.json`, `tables/*.csv`, `figures/*.png` for the active run; hash checks passed |
| Markdown link check (excluding `node_modules`; `file:///` links resolved) | 43 MD files scanned, 0 broken links |
| `node verify_demo_walkthrough.js` | 37/37 checks, status `completed`, 0 page errors |
| `git status` / `git log -3` | Working tree modified as expected; HEAD remains `22c9db3` (no new commits) |

---

## 4. Figures / screenshots actually opened

**None.** No image-viewing tool is available in this environment
(`Read` on a PNG returns "Current model cannot read image"). Screenshots below were
**captured** (evidence generation) but **not opened and inspected** — a human visual
review is **pending**.

- `data/verification/demo_walkthrough_1794132696085/step1.png` … `step9.png`
  (+ `stepN_text.txt`, `summary.json`)
- `data/verification/phase4_1794091462523/` (`summary.json` + 14 screenshots)
- `data/verification/scope_2021_2024_reverify_20261107_2354/` (`summary.json` + 11 screenshots)
- Supplementary (not dashboard): `analysis/output/findings/<run_id>/figures/inv1…inv5*.png`

---

## 5. Evidence index location

[demo_run_sheet.md § Screenshot fallback](file:///a:/Projects/crimescope/docs/demo_run_sheet.md#L80-L134)
— a 10-row table mapping each demo step to the exact screenshot file(s), route, state
shown, and source set, plus a stated coverage gap and "Visually reviewed: pending".

---

## 6. Automated walkthrough results

[data/verification/demo_walkthrough_1794132696085/summary.json](file:///a:/Projects/crimescope/data/verification/demo_walkthrough_1794132696085/summary.json):

- **37/37 checks passed**, `status: "completed"`, `pageErrors: []`.
- Automated duration **35,678 ms (35.7 s)** — machine wall-clock only; excludes the
  presenter's ~8–10 min speaking time.
- One benign console 404 (`/favicon.ico`, no favicon declared).
- Values matched the active release/run: 774 units, official 2024 total 2,740,258,
  annual totals 2,909,532 / 2,808,408 / 2,940,460 / 2,740,258, 749 matched units,
  PCA 15.9 / 4.6 / 20.5 %, cluster sizes 190/168/416, 697 rules over 35 pages,
  live release id and run `v4`.

---

## 7. Remaining manual checks

- **Human visual review** of the screenshots listed in §4 / the demo sheet evidence
  index (no image tool here).
- Confirm the steps covered only by the earlier route-set capture (demo steps 3, 4, 7, 9)
  look correct when opened.
- Live demo rehearsal on the presenter's machine (backend :4000, frontend :5173).

---

## 8. Preservation confirmation

- **Source data:** unchanged.
- **Canonical datasets / SQLite releases:** unchanged; all earlier releases preserved.
- **Production analysis artifacts & manifests:** unchanged.
- **Historical releases:** preserved, not rewritten.
- **Pointers:** `data/serving/current.json` and `analysis/output/runs/current.json`
  unchanged (still the values in §Verified pointers).
- **No** dataset rebuild, **no** model refit, **no** pointer change, **no** commit,
  **no** push, **no** deploy was performed. New research outputs live under
  `analysis/output/findings/` and verification evidence under `data/verification/`,
  separate from the immutable artifacts.
