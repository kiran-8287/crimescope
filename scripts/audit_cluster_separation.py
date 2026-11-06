import json
import csv
import numpy as np

with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/feature_input.csv", "r", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

def key(row):
    return row.get("region_id") or (row.get("state_name", "") + "|" + row["region_name"])

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

km_res = json.load(open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/kmeans/kmeans_2024_k3.json"))
assignments = [r["cluster_id"] for r in km_res["assignment_records"]]
counts = {c: sum(1 for a in assignments if a == c) for c in set(assignments)}
print("Cluster counts for k=3:", counts)

c_small = min(counts.keys(), key=lambda c: counts[c])
print(f"Small cluster index: {c_small} (count: {counts[c_small]})")

idx_small = [i for i, a in enumerate(assignments) if a == c_small]
for i in idx_small:
    print("  Member:", km_res["assignment_records"][i]["region"])

# Print centroid feature values stored in km_res
centroids = km_res["clusters"]
small_centroid = [c for c in centroids if c["cluster_id"] == c_small][0]
print("\nCentroid stored distinguishing features for small cluster:")
for f in small_centroid["features"][:10]:
    print(f"  {f['category'][:50]}: mean = {f['mean']:.2f}")


mean_small = X_scaled[idx_small].mean(axis=0)
devs = mean_small

top_cat_indices = np.argsort(devs)[::-1][:10]
print("\nTop features with highest positive deviation in transformed clustering space for small cluster:")
for idx in top_cat_indices:
    raw_vals = [matrix[regions[i]][categories[idx]] for i in idx_small]
    print(f"  {categories[idx][:50]}: dev = {devs[idx]:.2f}, raw values in the 4 units = {raw_vals}")
