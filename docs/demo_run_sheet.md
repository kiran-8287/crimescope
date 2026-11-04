# CrimeScope — Demo Run Sheet

## Pre-demo checklist

- [ ] Repository cloned and dependencies installed
- [ ] Raw data present in `data/raw/2020/` through `data/raw/2024/`
- [ ] Backend running on `http://localhost:4000`
- [ ] Frontend running on `http://localhost:5173`
- [ ] `/api/v1/health` returns `{"status":"ok"}`
- [ ] `/api/v1/overview` returns real data (not mock)

## Starting the application

### Backend
```bash
cd backend
npm install
npm run dev    # starts on http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # starts on http://localhost:5173
```

### Data pipeline (if raw data changed)
```bash
python scripts/build_phase_c.py          # canonical dataset
python scripts/run_methods_01_04.py      # methods 01-04
python scripts/run_methods_05_07.py      # methods 05-07
python scripts/run_methods_08_09.py      # methods 08-09
```

## Demo flow (10 minutes)

### 1. Overview (2 min)
- Navigate to `http://localhost:5173/overview`
- Observe KPI cards: total regions, categories, cases
- View top regions/categories bar charts
- Click "Download CSV" to export canonical dataset
- Review Data Provenance panel: release ID, source, generated timestamp

### 2. Regional Comparison (2 min)
- Navigate to `/regional-comparison`
- Select year (2020–2024) and optional category
- Observe bar chart ranking regions by total cases
- Review data table with mean, median, std, min, max

### 3. Trends (2 min)
- Navigate to `/trends`
- Select year, region, category
- Observe YoY line chart and change table
- Note pct_change column for increases/decreases

### 4. Data Quality (1 min)
- Navigate to `/data-quality`
- Review summary metrics: source rows, canonical observations, quarantined
- Review per-source accounting table
- Read methodology notes

### 5. PCA (1 min)
- Navigate to `/pca`
- Select year
- Observe explained variance ratio bar chart
- Observe eigenvalues chart
- Observe PC1 vs PC2 scatter plot of regions

### 6. Clusters (1 min)
- Navigate to `/clusters`
- Select year and k (3/4/5)
- Observe K-means cluster table with regions per cluster
- Observe hierarchical clustering merge history and final clusters

### 7. Unusual Changes (1 min)
- Navigate to `/anomalies`
- Select year
- Review cross-sectional anomalies (z-score ≥ 2.5σ)
- Review year-on-year anomalies (≥50% change)

### 8. Association Rules (1 min)
- Navigate to `/association-rules`
- Select year
- Review rules table: antecedent → consequent, support, confidence, lift

## Expected results

- Overview: ~38 regions, ~251 categories, ~17,906 observations (5 years)
- West Godavari typically top region by total cases
- PCA: PC1 explains majority of variance
- K-means k=3: high/medium/low volume clusters
- Anomalies: cross-sectional + YoY flags with direction
- Association rules: theft→hurt, murder→attempted murder patterns

## Rollback

If backend fails to start: check `data/serving/current.json` points to valid release.
If frontend fails: check Vite proxy targets `http://localhost:4000`.
If data missing: run `python scripts/build_phase_c.py` to regenerate.
