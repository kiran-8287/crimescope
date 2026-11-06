import sqlite3
import numpy as np
import json

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()

# Get 2024 total volume in one query
cur.execute("SELECT geography_id, reported_value FROM crime_observations WHERE year = 2024 AND original_category = 'Total Cognizable IPC/BNS crimes'")
vol_map = dict(cur.fetchall())

pca_res = json.load(open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/pca/pca_2024.json"))
components = pca_res["components"]

volumes = []
pc1_scores = []
pc2_scores = []

for item in components:
    gid = item["region_id"]
    if gid in vol_map and vol_map[gid] is not None:
        score_map = {s["component"]: s["score"] for s in item["scores"]}
        volumes.append(vol_map[gid])
        pc1_scores.append(score_map["PC1"])
        pc2_scores.append(score_map["PC2"])

vol = np.array(volumes)
p1 = np.array(pc1_scores)
p2 = np.array(pc2_scores)

print(f"Total units evaluated: {len(vol)}")
print(f"Correlation between Total Volume and PC1: {np.corrcoef(vol, p1)[0, 1]:.4f}")
print(f"Correlation between log1p(Total Volume) and PC1: {np.corrcoef(np.log1p(vol), p1)[0, 1]:.4f}")
print(f"Correlation between Total Volume and PC2: {np.corrcoef(vol, p2)[0, 1]:.4f}")
print(f"Correlation between log1p(Total Volume) and PC2: {np.corrcoef(np.log1p(vol), p2)[0, 1]:.4f}")
conn.close()

