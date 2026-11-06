"""
Verify PCA math against new v3 run:
  - Loadings = Pearson r between feature and PC score (within N vs N-1 convention)
  - PC1 volume association (r with log1p total)
Runs against: ncrb-national-2024-admin-log1p-zscore-20261106-v3
"""
import json, math, csv

RUN_DIR = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3"
PCA_FILE = f"{RUN_DIR}/pca/pca_2024.json"
FEATURE_FILE = f"{RUN_DIR}/feature_input.csv"

# Load PCA artifact
pca = json.load(open(PCA_FILE))
loadings = pca["loadings"]           # dict: feature_id -> [pc0, pc1, ...]
evr = pca["explained_variance_ratio"]
points = pca["points"]               # list of {id, pc0, pc1, ...}
features = pca.get("features", [])   # list of feature dicts

print(f"EVR[0]={evr[0]:.6f}, EVR[1]={evr[1]:.6f}")
print(f"Regions in PCA: {len(points)}")
print(f"Features: {len(loadings)}")

# Load feature matrix
feat_rows = []
with open(FEATURE_FILE, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    feat_rows = list(reader)

feat_ids = [r["geography_id"] for r in feat_rows]
print(f"Feature rows: {len(feat_rows)}")

# Build a map geo_id -> pc0 score from pca points
pc0_by_id = {p["id"]: p.get("pc0", p.get("scores", [None])[0]) for p in points}
pc1_by_id = {p["id"]: p.get("pc1", p.get("scores", [None, None])[1]) for p in points}

# Pearson correlation utility
def pearson(xs, ys):
    n = len(xs)
    mx = sum(xs)/n; my = sum(ys)/n
    num = sum((x-mx)*(y-my) for x,y in zip(xs,ys))
    dx = math.sqrt(sum((x-mx)**2 for x in xs))
    dy = math.sqrt(sum((y-my)**2 for y in ys))
    if dx == 0 or dy == 0: return 0.0
    return num / (dx * dy)

# Check a sample of feature loadings vs direct Pearson r
sample_features = list(loadings.keys())[:5]
print("\n=== Loading vs direct Pearson r (sample) ===")
max_diff = 0.0
errors = []
for fid in list(loadings.keys()):
    saved_loading = loadings[fid][0]  # PC0 loading
    # Get feature values aligned with pc0 scores
    vals = []
    pc0s = []
    for row in feat_rows:
        gid = row["geography_id"]
        if gid in pc0_by_id and pc0_by_id[gid] is not None:
            v = row.get(fid)
            if v is not None and v != "":
                try:
                    vals.append(float(v))
                    pc0s.append(float(pc0_by_id[gid]))
                except ValueError:
                    pass
    if len(vals) < 10:
        continue
    r = pearson(vals, pc0s)
    diff = abs(r - saved_loading)
    if diff > max_diff:
        max_diff = diff
    if diff > 0.01:
        errors.append((fid, saved_loading, r, diff))

print(f"Max diff (loading vs Pearson r): {max_diff:.6f}")
print(f"Tolerance check (< 0.001): {'PASS' if max_diff < 0.001 else 'FAIL'}")
if errors:
    print(f"Features with diff > 0.01: {len(errors)}")
    for e in errors[:3]:
        print(f"  {e[0]}: saved={e[1]:.4f} computed={e[2]:.4f} diff={e[3]:.4f}")

# Check PC1 vs log1p total
print("\n=== PC1 vs log1p(total) correlation ===")
# Find the official total category column in feature_input.csv
header = list(feat_rows[0].keys())
total_col = None
for col in header:
    if "total" in col.lower() and col != "geography_id":
        total_col = col
        break
if not total_col:
    # Try mapped category id
    import sqlite3
    conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite")
    cur = conn.cursor()
    cur.execute("SELECT mapped_category_id FROM crime_observations WHERE original_category LIKE '%Total Cognizable%' LIMIT 1")
    r = cur.fetchone()
    if r:
        total_col = r[0]
    conn.close()

print(f"Total column: {total_col}")
if total_col:
    pc1s = []
    log1p_tots = []
    for row in feat_rows:
        gid = row["geography_id"]
        if gid in pc1_by_id and pc1_by_id[gid] is not None:
            v = row.get(total_col)
            if v is not None and v != "":
                try:
                    pc1s.append(float(pc1_by_id[gid]))
                    log1p_tots.append(math.log1p(float(v)))
                except ValueError:
                    pass
    if pc1s:
        r_vol = pearson(log1p_tots, pc1s)
        print(f"r(log1p_total, PC1) = {r_vol:.4f}")
        print(f"Volume association check: {'PASS (|r|>0.7)' if abs(r_vol) > 0.7 else 'FAIL'}")
    else:
        print("No aligned rows found")

print("\nDone.")

