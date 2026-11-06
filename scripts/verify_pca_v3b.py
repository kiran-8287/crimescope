"""
Verify PCA loadings correctly as Pearson r on PREPROCESSED (log1p then zscore) data,
not raw data. The feature_input.csv contains raw counts; PCA was run on log1p + z-score.
"""
import json, math, csv
from collections import defaultdict

RUN_DIR = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3"
PCA_FILE = f"{RUN_DIR}/pca/pca_2024.json"
FEAT_FILE = f"{RUN_DIR}/feature_input.csv"

pca = json.load(open(PCA_FILE))
loadings_list = pca["loadings"]
components_list = pca["components"]
evr = pca["explained_variance_ratio"]
eigenvalues = pca["eigenvalues"]

# Build PC score lookup
pc_scores = {}
for c in components_list:
    rid = c["region_id"]
    pc_scores[rid] = {s["component"]: s["score"] for s in c["scores"]}

# Load feature matrix from long format
feat_wide = defaultdict(dict)
with open(FEAT_FILE, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        feat_wide[row["region_id"]][row["category_id"]] = float(row["total"] or 0)

all_rids = sorted(feat_wide.keys())
pc1_comp = loadings_list[0]
feat_loadings = {f["id"]: (f["loading"], f["category"]) for f in pc1_comp["features"]}
all_cat_ids = list(feat_loadings.keys())

print(f"n_regions: {len(all_rids)}, n_features: {len(all_cat_ids)}")

def pearson(xs, ys):
    n = len(xs)
    if n < 3: return float("nan")
    mx, my = sum(xs)/n, sum(ys)/n
    num = sum((x-mx)*(y-my) for x,y in zip(xs,ys))
    dx = math.sqrt(sum((x-mx)**2 for x in xs))
    dy = math.sqrt(sum((y-my)**2 for y in ys))
    return num/(dx*dy) if dx and dy else float("nan")

def zscore(vals):
    n = len(vals)
    m = sum(vals)/n
    s = math.sqrt(sum((v-m)**2 for v in vals)/n)  # population std (N denominator)
    return [(v-m)/s if s > 0 else 0.0 for v in vals]

# Build the full feature matrix in log1p + zscore form, aligned with pc scores
# For each category, transform raw values to log1p then zscore
region_order = [rid for rid in all_rids if rid in pc_scores]
print(f"Regions with PC scores: {len(region_order)}")

# Verify loadings using preprocessed features
print("\n=== Loading vs Pearson r on log1p+zscore features (PC1) ===")
max_diff = 0.0
large_diffs = []
n_checked = 0

for cid, (saved_loading, label) in feat_loadings.items():
    raw_vals = [feat_wide[rid].get(cid, 0.0) for rid in region_order]
    log_vals = [math.log1p(v) for v in raw_vals]
    z_vals = zscore(log_vals)
    pc1_vals = [float(pc_scores[rid].get("PC1", 0)) for rid in region_order]
    r = pearson(z_vals, pc1_vals)
    if math.isnan(r): continue
    diff = abs(r - saved_loading)
    if diff > max_diff: max_diff = diff
    if diff > 0.001: large_diffs.append((label, saved_loading, r, diff))
    n_checked += 1

print(f"Features checked: {n_checked}")
print(f"Max |loading - Pearson_r(zscore_feat, PC1)|: {max_diff:.6f}")
print(f"Tolerance (< 0.002): {'PASS' if max_diff < 0.002 else 'FAIL'}")
if large_diffs[:3]:
    for x in large_diffs[:3]:
        print(f"  {x[0][:40]}: saved={x[1]:.4f} computed={x[2]:.4f} diff={x[3]:.6f}")

# Try sample-std (N-1) zscore
print("\n=== With sample std (N-1) ===")
def zscore_n1(vals):
    n = len(vals)
    m = sum(vals)/n
    s = math.sqrt(sum((v-m)**2 for v in vals)/(n-1))
    return [(v-m)/s if s > 0 else 0.0 for v in vals]

max_diff2 = 0.0
n_checked2 = 0
for cid, (saved_loading, label) in feat_loadings.items():
    raw_vals = [feat_wide[rid].get(cid, 0.0) for rid in region_order]
    log_vals = [math.log1p(v) for v in raw_vals]
    z_vals = zscore_n1(log_vals)
    pc1_vals = [float(pc_scores[rid].get("PC1", 0)) for rid in region_order]
    r = pearson(z_vals, pc1_vals)
    if math.isnan(r): continue
    diff = abs(r - saved_loading)
    if diff > max_diff2: max_diff2 = diff
    n_checked2 += 1

print(f"Features checked (N-1): {n_checked2}")
print(f"Max diff (N-1 std): {max_diff2:.6f}")
print(f"Tolerance (< 0.002): {'PASS' if max_diff2 < 0.002 else 'FAIL'}")

# PC1 vs log1p(total) using the total cognizable from the RAW feature_input
# Total cog is NOT in feature set; must pull from SQLite
import sqlite3
DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute("""
    SELECT o.geography_id, o.reported_value
    FROM crime_observations o
    WHERE o.year=2024
      AND o.region_type='administrative_district'
      AND o.mapped_category_id='50920ae7b610c017c4ae1410'
      AND o.comparison_status='eligible'
""")
total_by_id = {r[0]: r[1] for r in cur.fetchall()}
conn.close()

print(f"\n=== PC1 vs log1p(Total Cognizable) ===")
print(f"Total rows from SQLite: {len(total_by_id)}")
pc0s_v, log_tots = [], []
for rid in region_order:
    tot = total_by_id.get(rid)
    pc0 = pc_scores[rid].get("PC1")
    if tot is None or pc0 is None: continue
    pc0s_v.append(float(pc0))
    log_tots.append(math.log1p(tot))

r_vol = pearson(log_tots, pc0s_v)
print(f"r(log1p_total_cog, PC1) = {r_vol:.4f}  n={len(pc0s_v)}")
print(f"Volume-association label: {'JUSTIFIED (|r|>0.7)' if abs(r_vol) > 0.7 else 'NOT JUSTIFIED (|r|<=0.7)'}")

print("\nDone.")

