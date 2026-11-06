"""
Audit Association rules arithmetic against the underlying transaction matrix.
"""
import json
import csv
from collections import Counter

FEATURE_PATH = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/feature_input.csv"
ASSOC_PATH = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261107-v4/association/association_rules_2024.json"

with open(ASSOC_PATH, "r", encoding="utf-8") as f:
    assoc = json.load(f)

N = assoc["n_transactions"]
rules = assoc["rules"]

# Build transactions
transactions = {}
with open(FEATURE_PATH, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rid = row["region_id"]
        if rid not in transactions:
            transactions[rid] = set()
        if int(row["total"]) >= 10:
            transactions[rid].add(row["category"])

# Filter out empty transactions
valid_transactions = [items for items in transactions.values() if len(items) > 0]
assert len(valid_transactions) == N, f"Transaction count mismatch: {len(valid_transactions)} vs {N}"

# Compute exact item frequencies
item_counts = Counter()
pair_counts = Counter()
for items in valid_transactions:
    for item in items:
        item_counts[item] += 1
    for a in items:
        for b in items:
            if a < b:
                pair_counts[(a, b)] += 1

errors = 0
for r in rules:
    a = r["antecedent"][0]
    c = r["consequent"][0]
    supp_cnt = pair_counts[(min(a, c), max(a, c))]
    cnt_a = item_counts[a]
    cnt_c = item_counts[c]
    
    calc_supp = round(supp_cnt / N, 4)
    calc_conf = round(supp_cnt / cnt_a, 4)
    calc_lift = round((supp_cnt * N) / (cnt_a * cnt_c), 4)
    
    if abs(r["support"] - calc_supp) > 1e-3 or abs(r["confidence"] - calc_conf) > 1e-3 or abs(r["lift"] - calc_lift) > 1e-3:
        errors += 1
        print(f"Mismatch in rule {a} -> {c}:")
        print(f"  Got: supp={r['support']}, conf={r['confidence']}, lift={r['lift']}")
        print(f"  Calc: supp={calc_supp}, conf={calc_conf}, lift={calc_lift}")

print(f"Verified {len(rules)} rules against raw transactions: {errors} arithmetic errors.")
