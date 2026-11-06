import csv
import numpy as np

csv_path = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/feature_input.csv"
rows = []
with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append(r)

four_members = {"Karnataka · Bidar", "Chhattisgarh · Bilaspur", "Madhya Pradesh · Gwalior", "Chhattisgarh · Balodbazar"}

by_region = {}
for r in rows:
    reg = f"{r['state_name']} · {r['region_name']}"
    if reg not in by_region:
        by_region[reg] = {}
    by_region[reg][r["category"]] = int(r["total"])

# Let's find categories where the 4 members have extreme values
categories = sorted(list(next(iter(by_region.values())).keys()))

# compute cohort statistics for each category
extreme_cats = []
for c in categories:
    all_vals = [by_region[reg][c] for reg in by_region]
    mean_val = np.mean(all_vals)
    std_val = np.std(all_vals)
    four_vals = [by_region[reg][c] for reg in four_members if reg in by_region]
    four_mean = np.mean(four_vals)
    z_in_cohort = (four_mean - mean_val) / (std_val if std_val > 0 else 1.0)
    if abs(z_in_cohort) > 5.0 or (four_mean > 100 and mean_val < 5):
        extreme_cats.append((c, four_mean, mean_val, z_in_cohort, four_vals))

print(f"Categories where 4 members are extreme (count: {len(extreme_cats)}):")
extreme_cats.sort(key=lambda x: abs(x[3]), reverse=True)
for c, f_m, c_m, z, vals in extreme_cats[:15]:
    print(f"  {c}: 4-member mean={f_m:.1f}, cohort mean={c_m:.1f}, z={z:.2f}, vals={vals}")

