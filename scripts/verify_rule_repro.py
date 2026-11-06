import json
import csv

rules_res = json.load(open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/association/association_rules_2024.json"))
rule = rules_res["rules"][0]
ante = set(rule["antecedent"])
cons = set(rule["consequent"])
both = ante | cons

with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/feature_input.csv", "r", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

def region_key(r):
    return r.get("region_id") or (r.get("state_name", "") + "|" + r["region_name"])

regions = sorted({region_key(r) for r in rows})

txns = []
for reg in regions:
    reg_rows = [r for r in rows if region_key(r) == reg]
    items = {r["category"] for r in reg_rows if r["total"] not in ("", None) and int(r["total"]) >= 10}
    if items:
        txns.append(items)

N = len(txns)
ante_count = sum(1 for t in txns if ante.issubset(t))
both_count = sum(1 for t in txns if both.issubset(t))
cons_count = sum(1 for t in txns if cons.issubset(t))

calc_sup = both_count / N
calc_conf = both_count / ante_count
calc_lift = calc_conf / (cons_count / N)

print("Rule:", rule["antecedent"], "->", rule["consequent"])
print(f"Saved:    support={rule['support']}, conf={rule['confidence']}, lift={rule['lift']}, count={rule['support_count']}")
print(f"Verified: support={calc_sup:.4f}, conf={calc_conf:.4f}, lift={calc_lift:.4f}, count={both_count}")

