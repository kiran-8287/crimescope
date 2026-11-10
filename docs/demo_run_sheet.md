# CrimeScope — Demo Run Sheet

**Target length:** 8–10 minutes. **Active release:**
`ncrb-districtwise-2021-2024-ecec48b772bc`. **Active run:**
`ncrb-national-2024-admin-log1p-zscore-20261107-v4`.

Use **year = 2024** and **reporting unit = administrative districts** unless a step
says otherwise; all numbers below are from the active release/run and are deterministic.

## Pre-demo checklist

- [ ] `data/serving/current.json` → release `…-ecec48b772bc`; `analysis/output/runs/current.json` → run `v4`.
- [ ] Backend running (default `http://localhost:4000`); the **root** health endpoint `/health`
  returns ok (there is no `/api/v1/health` — the backend only exposes `/health` and `/ready` at the root).
- [ ] Frontend running (default `http://localhost:5173`) with the pages below loading.
- [ ] Fallback screenshots available (see “Screenshot fallback” at the end).

## Run sheet

### 1 — Overview `/` (≈1 min) · method 01–02, finding context
- **Say:** “Recorded cases only — this is registration volume, not all crime, and there are no population denominators.”
- **Do:** open `/`, set year **2024**, unit type **administrative districts**; hover the top categories; click a district row to open the detail drawer.
- **Expected:** 774 administrative-district units; official 2024 total **2,740,258** reported cases; contextual labels show as `Parent › Leaf`.
- **Research point:** composition question (“what is reported in a region?”).
- **Limitation:** reported counts ≠ actual crime.

### 2 — Regional Comparison `/compare` (≈1 min) · comparison question
- **Say:** “I’m comparing two like-for-like reporting units; the app warns when unit types differ.”
- **Do:** open `/compare`, add **Arunachal Pradesh · Kameng West** and **Maharashtra · Gondia** (both 2024 administrative districts).
- **Expected:** side-by-side profiles; Kameng West is a low-volume unit (2024 k=3 **Cluster 2**, n = 168), Gondia a high-volume unit (2024 k=3 **Cluster 1**, n = 190); the page renders with no update loop. Verified values — total Cognizable IPC: **Kameng West 92**, **Gondia 3,922** (42.6× as many); multi-category profile (Kameng West → Gondia): Human Body **27 → 990**, Property **22 → 560**, Other IPC **16 → 19**, Miscellaneous **8 → 2,109**, Theft **18 → 393**, Hurt **11 → 604**, Rash Driving **7 → 490**.
- **Research point:** comparison question 2.
- **Limitation:** matching units is operational; profiles are not safety scores.

### 3 — Trends `/trends` (≈1.5 min) · finding 2
- **Say:** “Annual totals are four separate annual snapshots on a zero-baseline lakh scale — not a line joined across the 2023→2024 framework change; and on the same named units the 2022→2023 rise is smaller than the annual figures suggest.”
- **Do:** open `/trends`, view **1. Annual recorded totals** (four separate bars from a zero baseline with a clean lakh ladder, 2024 set apart by a labelled IPC→BNS framework break); then switch to the **2. Name-matched 2022–2023** tab (two bars on the same zero-baseline scale, plus a labelled dumbbell and the +88,343 / +3.15 % callouts); open the reconciliation panel.
- **Expected:** annual totals **2,909,532 (2021) → 2,808,408 (2022) → 2,940,460 (2023) → 2,740,258 (2024)** with unit counts **726 / 750 / 770 / 774**; the matched tab shows **749** units, **2,804,254 → 2,892,597** cases, **+88,343** cases (**+3.15 %**). Two change measures sit side by side — annual set **+4.70 %** (750→770 units) vs matched set **+3.15 %** (749→749); the gap is *not* a causal estimate. Reconciliation: annual = matched + excluded — 2022 excludes **1 unit / 4,154 cases**, 2023 excludes **21 units / 47,863 cases** (unmatched names can be renames/reorganisations).
- **Research point:** restricting the comparison to the same named reporting units lowers the measured increase from 4.70 % to 3.15 %; this controls membership in the comparison set but does not establish unchanged reporting boundaries.
- **Limitation:** name matching is **not** proof of boundary continuity; **2023–2024 is deliberately not compared** (IPC→BNS).

### 4 — Data Quality `/quality` (≈30 s) · method 01
- **Say:** “The release is versioned and hash-verified; here is the row accounting.”
- **Do:** open `/quality`.
- **Expected:** retained observations **546,198** (of 567,078 canonical rows; 20,880 aggregate), explicit zeros shown separately, 0 nulls.
- **Limitation:** administrative-district classification is partly inferred.

### 5 — PCA `/pca` (≈1 min) · finding 1, method 05
- **Say:** “Two components retain about a fifth of the variance, so this is a summary — not a full similarity map.”
- **Do:** open `/pca`, year **2024**; point at the two-component retained-variance chart, then the PCA score plot (PC1–PC2 scatter).
- **Expected:** **PC1 15.91 %**, **PC2 4.57 %**, together **20.48 %**; PC1 tracks volume (`corr(PC1, log1p total) = −0.88`); loadings shown with contextual labels (e.g. Vehicle Theft, Murder).
- **Research point:** PC1 sign is arbitrary; closeness ≠ near-identical profiles.
- **Limitation:** PCA did not isolate composition from volume.

### 6 — Clusters `/clusters` (≈1 min) · finding 3, method 06–07
- **Say:** “k=3 is the selected model; the sizes and deviations come straight from the saved run.”
- **Do:** open `/clusters`, year **2024**, k **3**; scroll to the feature-deviation profiles and representative units.
- **Expected:** cluster sizes **190 / 168 / 416**; official-total medians **5,309 / 159.5 / 2,974.5**; C1 high on Stalking/Day Burglary, C2 low on Murder/Vehicle Theft.
- **Research point:** profile similarity against the national average (centroid z = 0).
- **Limitation:** inertia falls with k — **no optimal k is declared**; clusters are not urban/rural or safe/unsafe.

### 7 — Anomalies `/anomalies` (≈1 min) · finding 4, method 08
- **Say:** “A flag just means ‘unusual for its category’, using a sample std — it is not an error or a risk score.”
- **Do:** open `/anomalies`, year **2024**; show the **rare-category** tab then the **high-volume** tab.
- **Expected:** rare — *Abetment outside India*, **Satara, Maharashtra**, value 1 (773/774 zeros); the **Mathematical Note** on the page shows that a single positive in a 774-unit cohort gives z ≈ **27.78**. The **High-Volume Outliers** tab lists flagged rows by descending z (top row ≈ **+27.65σ**, e.g. Imphal West rioting); the documented **z ≈ 10.89** instance (*Other Thefts/305/307*, **North-West, Delhi**, 13,156 cases) is a saved-artifact value, not the first-page row. The page states the sample-std (ddof=1) convention.
- **Research point:** the rare z is a near-zero-baseline artefact, not a big number.
- **Limitation:** flag ≠ data error, wrongdoing or risk.

### 8 — Association Rules `/rules` (≈1 min) · finding 5, method 09
- **Say:** “These are district-level co-occurrences, not shared incidents.”
- **Do:** open `/rules`, year **2024**; use the single pagination control to go to **page 2** and then the **last page**; open one rule’s interpretation drawer.
- **Expected:** **739** qualifying transactions, **697** rules, 35 pages; one pagination control (“Showing X–Y of 697 rules · Page A of B”); a highlighted rule **Stalking → Arson** with support 0.166, confidence 0.669, lift **2.27**; baseline prevalence shown next to conditional.
- **Research point:** lift is relative to the consequent’s own prevalence.
- **Limitation:** item present at count ≥ 10 → 739-transaction population; no incident/offender/causal claims.

### 9 — Methodology `/methodology` (≈30 s) · provenance
- **Say:** “The page shows the live release and run hashes and answers the five research questions.”
- **Do:** open `/methodology`.
- **Expected:** live release `…-ecec48b772bc`, live run `v4`; artifact hashes verify at load; composition shares disabled.
- **Limitation:** reported counts, no rates, no cross-framework trends.

## Presentation asset pack (new)

`python scripts/export_presentation_assets.py` writes a fresh, timestamped pack under
`analysis/output/presentation/<run_id>/<timestamp>/` — 18 figures (PNG **2560×1440** + SVG),
19 CSV tables, `results.json` and `figure_manifest.json`. It validates the pointer/manifest
hashes, loads the saved memberships/scores/centroids/rules/linkage and **never refits**;
every figure carries a question/claim title, scope, units, caption and limitation. Latest
pack: `analysis/output/presentation/ncrb-national-2024-admin-log1p-zscore-20261107-v4/20261108T191655Z/`.
See [`PRESENTATION_RESULTS.md`](../PRESENTATION_RESULTS.md) for the slide-by-slide mapping
and the figure → question/limitation index.

## Screenshot fallback

If the live backend/frontend is unavailable, the run sheet can still be walked through
using the captures below. All paths are relative to the repository root and currently
exist on disk as **untracked** files (`analysis/output/` and `data/verification/` are not
committed). Unless a row says otherwise these are **dashboard captures taken with the
active release/run**; the research `figures/*.png` are script-generated charts and are
**not** dashboard screenshots.

- **Primary set — `data/verification/final_closure_1794162164706/`** (the §9 closure
  package; captured 2026-11-08T18:22:44Z–18:25:22Z; release `…-ecec48b772bc`,
  run `…-v4`; **135/135** automated browser assertions passed, 0 console errors,
  0 page errors, and all **39** viewport/zoom overflow measurements **0 px** — see
  `summary.json`, `assertions.json`, `api_requests.json`, `errors.json`,
  `evidence_index.json`, and `captures/`).
- **Demonstration walkthrough — `data/verification/demo_walkthrough_1794162325606/`**
  (steps 1–9 followed **in order**; `summary.json`, `step1.png`…`step9.png` and
  `stepN_text.txt` per step; **44/44 automated checks passed**, captured 2026-11-08,
  **automated duration 34.2 s** — machine wall-clock only, it excludes the presenter's
  ~8–10 min speaking time; 0 console errors, 0 page errors).
- **Phase-4 set — `data/verification/phase4_1794162049903/`** (focused assertions;
  **34/34**, 0 errors).
- **Route set — `data/verification/scope_2021_2024_reverify_20261107_2354/`** (all nine
  routes; captured 2026-11-07T18:24Z, i.e. earlier than the sets above).
- **Chart-width set — `data/verification/presentation_charts_20261109/`** (new; Overview and
  both Trends modes captured at **desktop 1440 / laptop 1280 / tablet 834 / mobile 390** px —
  `overview_*.png`, `trends_annual_*.png`, `trends_matched_*.png`; `summary.json` records the
  SVG-frame measurement: **0 overflowing text nodes** in every chart at every width and 0 page
  errors). These are machine-measured captures; a human visual pass has **not** been performed.

| Demo step | Screenshot file(s) | Route | State shown | Source set | Visually reviewed |
|---|---|---|---|---|---|
| 1 Overview | `01_overview.png`; `step1.png`; `08_category_context.png` | `/` | 2024 admin districts; contextual label `Sexual Harassment › In Any other place` | closure + walkthrough + phase-4 | No — automated assertions only |
| 2 Compare | `02_compare_two_units.png`; `step2.png` | `/compare` | Kameng West (92) + Gondia (3,922); multi-category profile table | closure + walkthrough | No |
| 3 Trends | `03_trends_matched.png`; `step3.png`; `trends_annual_*.png`; `trends_matched_*.png` | `/trends` | four annual bars + 2022–2023 name-matched cohort + reconciliation | closure + walkthrough + chart-width | No |
| 4 Quality | `04_quality.png`; `step4.png` | `/quality` | release row accounting | closure + walkthrough | No |
| 5 PCA | `05_pca.png`; `step5.png` | `/pca` | PC1 15.91 % / PC2 4.57 % / 20.48 %; PCA score plot | closure + walkthrough | No |
| 6 Clusters | `06_clusters.png`; `step6.png` | `/clusters` | k=3 sizes 190/168/416; representative units | closure + walkthrough | No |
| 7 Anomalies | `07b_anomalies_higher_count.png` (+ `07a_anomalies_all.txt`); `step7.png` | `/anomalies` | rare-category and high-volume tabs | closure + walkthrough | No |
| 8 Rules | `08a_rules_page2.png`; `08b_rules_last_page.png`; `08c_rules_interpret_drawer.png`; `step8.png` | `/rules` | single pagination owner; 697 rules; last page "681–697 of 697 rules · Page 35 of 35" | closure + walkthrough | No |
| 9 Methodology | `09_methodology.png`; `step9.png` | `/methodology` | live release/run hashes | closure + walkthrough | No |
| Narrow viewport | `vp_mobile_390_*.png`; `vp_tablet_768_*.png`; `zoom200_*.png` | `/` `/compare` `/pca` `/clusters` `/anomalies` `/rules` | 390 px, 768 px and 200 %-zoom emulation (683×384); **0 px** overflow | closure | No |

Filename prefixes: the bare `0N…` names are in `final_closure_1794162164706/captures/`
(as are `vp_*` and `zoom200_*`); `stepN.png` are in
`demo_walkthrough_1794162325606/`; `page_*.png` are in the earlier route set.

**Coverage.** Every demo step 1–9 now has fresh captures in the closure package and the
walkthrough. The association-rules **last page** evidence is
`final_closure_1794162164706/captures/08b_rules_last_page.png` (its `.txt` records
"Showing 681–697 of 697 rules · Page 35 of 35").

**Capture / generation times.** Closure set 2026-11-08T18:22:44Z–18:25:22Z; walkthrough
2026-11-08; route set 2026-11-07T18:24Z; research figures regenerated by
`python scripts/research_findings.py` (see `findings.json` → `generated_at_utc`).

**Supplementary research figures (not dashboard screenshots).** Script-generated charts
under `analysis/output/findings/ncrb-national-2024-admin-log1p-zscore-20261107-v4/figures/`
(`inv1_pca_volume.png`, `inv2_annual_vs_matched.png`, `inv3_cluster_totals.png`,
`inv4_flags.png`, `inv5_rule_baselines.png`). Use these as supporting evidence for the
numeric findings only; they are not captures of the dashboard UI.

**Visually reviewed: pending.** No screenshot has been opened or inspected in this
environment (no image-viewing tool is available), so visual review is **not** claimed.
The sets' `summary.json` files record machine assertions only; a human must open the
files listed above before claiming a visual pass.

## Rollback

- Backend won’t start → check `data/serving/current.json` points to a valid release.
- Frontend won’t start → check `frontend/.env` has `VITE_DATA_MODE=api` and a reachable
  `VITE_API_BASE_URL`; the frontend calls the API directly (there is no Vite proxy).
- Findings won’t regenerate → `python scripts/research_findings.py` (fails closed on hash mismatch).
- Presentation pack won’t export → `python scripts/export_presentation_assets.py` (fails closed on
  pointer/manifest hash mismatch and refuses to overwrite an existing timestamp directory).
