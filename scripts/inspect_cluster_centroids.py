import csv
import numpy as np

csv_path = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/feature_input.csv"
rows = []
with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append(r)

regions = sorted(list({f"{r['state_name']} · {r['region_name']}" for r in rows}))
categories = sorted(list({r["category"] for r in rows}))

by_region = {reg: {} for reg in regions}
for r in rows:
    reg = f"{r['state_name']} · {r['region_name']}"
    by_region[reg][r["category"]] = int(r["total"])

X = np.zeros((len(regions), len(categories)))
for i, reg in enumerate(regions):
    for j, cat in enumerate(categories):
        X[i, j] = by_region[reg][cat]

# log1p + z-score
X_log = np.log1p(np.maximum(X, 0))
scales = X_log.std(axis=0, ddof=0)
scales[scales == 0] = 1.0
X_z = (X_log - X_log.mean(axis=0)) / scales

import json
with open('analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/kmeans/kmeans_2024_k3.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

# check centroid of cluster 0 vs cluster 1 vs cluster 2
centroids = []
for c in d['clusters']:
    c_indices = [regions.index(r) for r in c['regions']]
    c_mean = X_z[c_indices].mean(axis=0)
    centroids.append(c_mean)

# Top distinguishing features of cluster 0 compared to overall mean (which is 0 in X_z)
c0_mean = centroids[0]
top_feats = np.argsort(np.abs(c0_mean))[::-1][:10]
print("Cluster 0 top distinguishing transformed features:")
for idx in top_feats:
    print(f"  {categories[idx]}: z_centroid={c0_mean[idx]:.2f}, c1={centroids[1][idx]:.2f}, c2={centroids[2][idx]:.2f}")

