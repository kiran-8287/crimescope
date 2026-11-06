import json
import csv
import numpy as np

pca_res = json.load(open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/pca/pca_2024.json"))

with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/feature_input.csv", "r", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

# Re-run the exact _prepare from pca.py
def key(row):
    return row.get("region_id") or f"{row.get('state_name', '')}|{row['region_name']}"

regions = sorted({key(r) for r in rows})
categories = sorted({r["category"] for r in rows})
matrix = {r: {c: 0 for c in categories} for r in regions}
for r in rows:
    matrix[key(r)][r["category"]] = int(r["total"]) if r.get("total") else 0

X_raw = np.asarray([[float(matrix[reg][cat]) for cat in categories] for reg in regions], dtype=float)
X_log = np.log1p(np.maximum(X_raw, 0.0))
scales = X_log.std(axis=0, ddof=0)
scales[scales == 0] = 1.0
X_scaled = (X_log - X_log.mean(axis=0)) / scales
centered = X_scaled - X_scaled.mean(axis=0)

u, singular, vt = np.linalg.svd(centered, full_matrices=False)
scores_pc1 = u[:, 0] * singular[0]
scores_pc2 = u[:, 1] * singular[1]

# Directly compute Pearson correlation between each feature in centered and scores_pc1
# Pearson corr between vector a and b:
direct_corrs_pc1 = []
direct_corrs_pc2 = []
for j in range(len(categories)):
    r1 = np.corrcoef(centered[:, j], scores_pc1)[0, 1]
    r2 = np.corrcoef(centered[:, j], scores_pc2)[0, 1]
    direct_corrs_pc1.append(r1)
    direct_corrs_pc2.append(r2)

saved_loadings_pc1 = [f["loading"] for f in pca_res["loadings"][0]["features"]]
saved_loadings_pc2 = [f["loading"] for f in pca_res["loadings"][1]["features"]]

diff1 = np.abs(np.array(direct_corrs_pc1) - np.array(saved_loadings_pc1))
diff2 = np.abs(np.array(direct_corrs_pc2) - np.array(saved_loadings_pc2))

print(f"PC1: max abs diff between direct Pearson correlation and saved loading: {np.max(diff1):.8f}")
print(f"PC2: max abs diff between direct Pearson correlation and saved loading: {np.max(diff2):.8f}")
print(f"PC1 sample values: Direct={direct_corrs_pc1[:3]}, Saved={saved_loadings_pc1[:3]}")

