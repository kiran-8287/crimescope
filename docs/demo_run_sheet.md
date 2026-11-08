# CrimeScope — Demo Run Sheet

**Target length:** 8–10 minutes. **Active release:**
`ncrb-districtwise-2021-2024-ecec48b772bc`. **Active run:**
`ncrb-national-2024-admin-log1p-zscore-20261107-v4`.

Use **year = 2024** and **reporting unit = administrative districts** unless a step
says otherwise; all numbers below are from the active release/run and are deterministic.

## Pre-demo checklist

- [ ] `data/serving/current.json` → release `…-ecec48b772bc`; `analysis/output/runs/current.json` → run `v4`.
- [ ] Backend running (default `http://localhost:4000`), `/api/v1/health` returns ok.
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
- **Expected:** side-by-side profiles; Kameng West is a low-volume unit (k=3 cluster C2), Gondia a high-volume unit (cluster C1); the page renders with no update loop.
- **Research point:** comparison question 2; fixed in a prior segment (memoised analytics + bail-out updaters).
- **Limitation:** matching units is operational; profiles are not safety scores.

### 3 — Trends `/trends` (≈1.5 min) · finding 2
- **Say:** “The raw annual line rises into 2023, but on the same units the rise is smaller.”
- **Do:** open `/trends`, view **Annual Recorded Totals**; then the **matched 2022–2023** cohort view.
- **Expected:** annual totals **2,909,532 (2021) → 2,808,408 (2022) → 2,940,460 (2023) → 2,740,258 (2024)**; the 2023-vs-2022 annual change is **+4.70 %** (derived from the two annual totals); on **749** matched units the cohort label shows **(3.2 % change)** — the exact ratio is 3.15 %, rounded to one decimal on screen.
- **Research point:** restricting the comparison to the same named reporting units reduces the measured increase from 4.70 % to 3.15 %; this controls membership in the comparison set but does not establish unchanged reporting boundaries.
- **Limitation:** name matching is **not** proof of boundary continuity; **2023–2024 is deliberately not compared** (IPC→BNS).

### 4 — Data Quality `/quality` (≈30 s) · method 01
- **Say:** “The release is versioned and hash-verified; here is the row accounting.”
- **Do:** open `/quality`.
- **Expected:** retained observations **546,198** (of 567,078 canonical rows; 20,880 aggregate), explicit zeros shown separately, 0 nulls.
- **Limitation:** administrative-district classification is partly inferred.

### 5 — PCA `/pca` (≈1 min) · finding 1, method 05
- **Say:** “Two components retain about a fifth of the variance, so this is a summary — not a full similarity map.”
- **Do:** open `/pca`, year **2024**; point at the scree/cumulative bars, then the PC1–PC2 scatter.
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

## Screenshot fallback

If the live backend/frontend is unavailable, the run sheet can still be walked through
using the captures below. All paths are relative to the repository root and currently
exist on disk as **untracked** files (`analysis/output/` and `data/verification/` are not
committed). Unless a row says otherwise these are **dashboard captures taken with the
active release/run**; the research `figures/*.png` are script-generated charts and are
**not** dashboard screenshots.

- **Primary set — `data/verification/phase4_1794091462523/`** (latest v4 corrections;
  captured 2026-11-07T22:44:22Z–22:44:52Z; release `…-ecec48b772bc`, run `…-v4`;
  33/33 automated browser assertions passed — see its `summary.json`).
- **Route set — `data/verification/scope_2021_2024_reverify_20261107_2354/`** (all nine
  routes; captured 2026-11-07T18:24Z, i.e. earlier than the primary set).
- **Demonstration walkthrough — `data/verification/demo_walkthrough_1794132696085/`**
  (steps 1–9 followed **in order**; `summary.json`, `step1.png`…`step9.png`, and
  `stepN_text.txt` per step; **37/37 automated checks passed**, finished
  2026-11-08T10:12:12Z, **automated duration 35.7 s** — machine wall-clock only, it
  excludes the presenter's ~8–10 min speaking time; 0 page errors, 1 benign
  `/favicon.ico` 404). This is the rehearsal artifact for the pass itself.

| Demo step | Screenshot file(s) | Route | State shown | Source set | Visually reviewed |
|---|---|---|---|---|---|
| 1 Overview | `page_overview.png`; `08_category_context.png` | `/` | 2024 admin districts; contextual label `Sexual Harassment › In Any other place` | route set + primary | No — automated assertions only |
| 2 Compare | `09_compare.png`; `page_compare.png` | `/compare` | two 2024 units selected; comparison table renders | primary + route set | No |
| 3 Trends | `page_trends.png` | `/trends` | annual totals + 2022–2023 matched cohort | route set (earlier capture) | No |
| 4 Quality | `page_quality.png` | `/quality` | release row accounting | route set (earlier capture) | No |
| 5 PCA | `04_pca_captions.png`; `05_pca_drawer_default_k3.png` | `/pca` | PC1 15.9 % / PC2 4.6 % / 20.5 %; PCA score plot; default-k=3 drawer | primary | No |
| 6 Clusters | `07_clusters.png`; `06_clusters_drawer_k3.png` / `_k4.png` / `_k5.png` | `/clusters` | k=3 sizes 190/168/416; drawer membership matches saved k=3/4/5 | primary | No |
| 7 Anomalies | `page_anomalies.png` | `/anomalies` | rare-category and high-volume tabs | route set (earlier capture) | No |
| 8 Rules | `01_rules_page2.png`; `02_rules_last_page.png`; `03_rules_interpret_drawer.png` | `/rules` | single pagination owner; 697 rules; interpretation drawer | primary | No |
| 9 Methodology | `page_methodology.png` | `/methodology` | live release/run hashes | route set (earlier capture) | No |
| Narrow viewport | `10_narrow_rules.png`, `10_narrow_pca.png`, `10_narrow_clusters.png` | `/rules`, `/pca`, `/clusters` | 720 px viewport, 0 px horizontal overflow | primary | No |

Filename prefixes: `page_*.png` are in the route set; the bare/prefixed names
(`01…`–`10…`) are in `phase4_1794091462523/`.

**Coverage gaps.** No step is entirely uncovered, but steps **3, 4, 7 and 9** are covered
only by the earlier route-set capture (page renders), not by the primary phase-4 set;
step 1's contextual-label evidence comes from `phase4_1794091462523/08_category_context.png`.

**Capture / generation times.** Primary set 2026-11-07T22:44:22Z; route set
2026-11-07T18:24Z; research figures regenerated by `python scripts/research_findings.py`
(see `findings.json` → `generated_at_utc`).

**Supplementary research figures (not dashboard screenshots).** Script-generated charts
under `analysis/output/findings/ncrb-national-2024-admin-log1p-zscore-20261107-v4/figures/`
(`inv1_pca_volume.png`, `inv2_annual_vs_matched.png`, `inv3_cluster_totals.png`,
`inv4_flags.png`, `inv5_rule_baselines.png`). Use these as supporting evidence for the
numeric findings only; they are not captures of the dashboard UI.

**Visually reviewed: pending.** No screenshot has been opened or inspected in this
environment (no image-viewing tool is available), so visual review is **not** claimed.
The primary set's `summary.json` records machine assertions only; a human must open the
files listed above before claiming a visual pass.

## Rollback

- Backend won’t start → check `data/serving/current.json` points to a valid release.
- Frontend won’t start → check the Vite proxy targets `http://localhost:4000`.
- Findings won’t regenerate → `python scripts/research_findings.py` (fails closed on hash mismatch).
