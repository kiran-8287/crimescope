"""
Task 3: Verify PCA loading labels and PC1-volume correlation for v3 run.
Feature input is in long format: year, state_name, region_name, region_type,
region_id, category, category_id, total, quality_status.
"""
import json, math, csv
from collections import defaultdict

RUN_DIR = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3"
PCA_FILE = f"{RUN_DIR}/pca/pca_2024.json"
FEAT_FILE = f"{RUN_DIR}/feature_input.csv"
TOTAL_CAT = "Total Cognizable IPC/BNS crimes"

pca = json.load(open(PCA_FILE))
loadings_list = pca["loadings"]
components_list = pca["components"]
evr = pca["explained_variance_ratio"]
eigenvalues = pca["eigenvalues"]
n_regions = pca["n_regions"]

print(f"n_regions: {n_regions}")
print(f"n_components: {pca['n_components']}")
print(f"EVR[0]={evr[0]:.6f}  EVR[1]={evr[1]:.6f}")

# Build PC score lookup: region_id -> {PC1: score, PC2: score}
pc_scores = {}
for c in components_list:
    rid = c["region_id"]
    pc_scores[rid] = {s["component"]: s["score"] for s in c["scores"]}

print(f"Region scores loaded: {len(pc_scores)}")

# Load feature matrix from long format
# Build wide: region_id -> {category_id -> total}
feat_wide = defaultdict(dict)
feat_meta = {}  # region_id -> (region_name, state_name)
with open(FEAT_FILE, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        rid = row["region_id"]
        cid = row["category_id"]
        feat_wide[rid][cid] = float(row["total"] or 0)
        feat_meta[rid] = (row["region_name"], row["state_name"])

print(f"Feature regions loaded: {len(feat_wide)}")
all_cats = set()
for cats in feat_wide.values():
    all_cats.update(cats.keys())
print(f"Distinct category_ids: {len(all_cats)}")

# PC1 component loadings
pc1_comp = loadings_list[0]
print(f"\nPC1: {pc1_comp['component']}, EVR={pc1_comp['explained_variance_ratio']:.6f}")
feat_loadings = {f["id"]: (f["loading"], f["category"]) for f in pc1_comp["features"]}
print(f"Features with PC1 loadings: {len(feat_loadings)}")

# Pearson r utility
def pearson(xs, ys):
    n = len(xs)
    if n < 3: return float("nan")
    mx, my = sum(xs)/n, sum(ys)/n
    num = sum((x-mx)*(y-my) for x,y in zip(xs,ys))
    dx = math.sqrt(sum((x-mx)**2 for x in xs))
    dy = math.sqrt(sum((y-my)**2 for y in ys))
    return num/(dx*dy) if dx and dy else float("nan")

# Recompute Pearson r for each feature vs PC1 score
print("\n=== Loading vs Pearson r (PC1, all features) ===")
max_diff = 0.0
n_checked = 0
large_diffs = []

for cid, (saved_loading, cat_label) in feat_loadings.items():
    vals, pc0s = [], []
    for rid, cats in feat_wide.items():
        if rid not in pc_scores: continue
        v = cats.get(cid)
        pc0 = pc_scores[rid].get("PC1")
        if v is None or pc0 is None: continue
        vals.append(v)
        pc0s.append(float(pc0))
    if len(vals) < 10: continue
    r = pearson(vals, pc0s)
    if math.isnan(r): continue
    diff = abs(r - saved_loading)
    if diff > max_diff: max_diff = diff
    if diff > 0.001: large_diffs.append((cid, cat_label, saved_loading, r, diff))
    n_checked += 1

print(f"Features checked: {n_checked}")
print(f"Max |loading - Pearson_r|: {max_diff:.6f}")
print(f"Tolerance (< 0.002): {'PASS' if max_diff < 0.002 else 'FAIL'}")
if large_diffs:
    print(f"Features with diff > 0.001: {len(large_diffs)}")
    for item in large_diffs[:5]:
        print(f"  [{item[0][:8]}] {item[1][:40]}: saved={item[2]:.4f} computed={item[3]:.4f} diff={item[4]:.6f}")

# PC1 vs log1p(total_cognizable) — find the total category id
total_cat_id = None
for cid, (_, label) in feat_loadings.items():
    if "Total Cognizable" in label or "Total IPC" in label or "Total BNS" in label:
        total_cat_id = cid
        print(f"\nFound total category: {label} [{cid}]")
        break

if not total_cat_id:
    # Try the known ID
    total_cat_id = "50920ae7b610c017c4ae1410"
    print(f"\nUsing hardcoded total category id: {total_cat_id}")

pc0s_vol, log1p_tots = [], []
for rid, cats in feat_wide.items():
    if rid not in pc_scores: continue
    v = cats.get(total_cat_id)
    pc0 = pc_scores[rid].get("PC1")
    if v is None or pc0 is None: continue
    pc0s_vol.append(float(pc0))
    log1p_tots.append(math.log1p(v))

r_vol = pearson(log1p_tots, pc0s_vol)
print(f"r(log1p_total, PC1) = {r_vol:.4f}  n={len(pc0s_vol)}")
print(f"Volume-association: {'JUSTIFIED (|r|>0.7)' if abs(r_vol) > 0.7 else 'WEAK (|r|<=0.7)'}")

# Classification confidence note
print(f"\n=== Classification confidence ===")
print("Name-based classification does not prove administrative-district status.")
print("The classifier uses boundary-aware regex on region_name strings.")
print("Classifications are marked as 'regex_inferred' in the audit CSV, NOT gazette-verified.")
print("783 is the count produced by the documented classification process, not a verified count.")

print("\nDone.")
