import csv

with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/feature_input.csv", "r", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

def region_key(r):
    return r.get("region_id") or (r.get("state_name", "") + "|" + r["region_name"])

regions = sorted({region_key(r) for r in rows})
print("Total regions in feature_input.csv:", len(regions))

active_txns = []
empty_regions = []
for reg in regions:
    reg_rows = [r for r in rows if region_key(r) == reg]
    items = {r["category"] for r in reg_rows if r["total"] not in ("", None) and int(r["total"]) >= 10}
    if items:
        active_txns.append(reg)
    else:
        empty_regions.append((reg, reg_rows[0].get("state_name"), reg_rows[0].get("region_name")))

print("Regions with >=1 category having >=10 cases (active transactions):", len(active_txns))
print("Regions excluded because 0 categories had >=10 cases:", len(empty_regions))
print("\nSample excluded regions (low volume / sparse units):")
for r in empty_regions[:10]:
    print(" ", r)

