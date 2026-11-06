import json
import numpy as np

# Load pca result
pca_res = json.load(open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/pca/pca_2024.json"))

# Reconstruct centered matrix X and scores
# From feature_input.csv
import csv
with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/feature_input.csv", "r", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

# Let's inspect loadings
pc1_loadings = {f["id"]: f["loading"] for f in pca_res["loadings"][0]["features"]}

# Let's check min and max loading
l_vals = list(pc1_loadings.values())
print(f"PC1 Loadings: min = {min(l_vals):.4f}, max = {max(l_vals):.4f}")

# Check PC2 loadings
pc2_loadings = {f["id"]: f["loading"] for f in pca_res["loadings"][1]["features"]}
l2_vals = list(pc2_loadings.values())
print(f"PC2 Loadings: min = {min(l2_vals):.4f}, max = {max(l2_vals):.4f}")

