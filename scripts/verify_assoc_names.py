"""
Verify association-rule arithmetic with category NAME as item identifier.
"""
import json, csv
from collections import defaultdict

RUN_DIR = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3"
RULES_FILE = f"{RUN_DIR}/association/association_rules_2024.json"
FEAT_FILE = f"{RUN_DIR}/feature_input.csv"

data = json.load(open(RULES_FILE))
rules = data["rules"]
expected_N = data["n_transactions"]

# Rebuild transactions using category NAME (not category_id)
region_items = defaultdict(set)
with open(FEAT_FILE, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        val = float(row["total"] or 0)
        if val >= 10:
            region_items[row["region_id"]].add(row["category"])

qualifying_transactions = [items for items in region_items.values() if items]
N = len(qualifying_transactions)

print(f"Artifact n_transactions: {expected_N}")
print(f"Rebuilt qualifying transactions: {N}")
assert N == expected_N

# Verify arithmetic on all rules
max_supp_diff = 0.0
max_conf_diff = 0.0
max_lift_diff = 0.0
mismatches = 0

for i, rule in enumerate(rules):
    ant = rule["antecedent"]
    con = rule["consequent"]
    ant_set = frozenset(ant if isinstance(ant, list) else [ant])
    con_set = frozenset(con if isinstance(con, list) else [con])
    
    joint = sum(1 for t in qualifying_transactions if ant_set <= t and con_set <= t)
    ant_c = sum(1 for t in qualifying_transactions if ant_set <= t)
    con_c = sum(1 for t in qualifying_transactions if con_set <= t)
    
    supp_c = joint / N
    conf_c = joint / ant_c if ant_c > 0 else 0
    lift_c = (joint * N) / (ant_c * con_c) if (ant_c > 0 and con_c > 0) else 0
    
    saved_supp = rule.get("support", 0)
    saved_conf = rule.get("confidence", 0)
    saved_lift = rule.get("lift", 0)
    
    # Note: saved metrics in artifact appear rounded to 4 decimals
    ds = abs(supp_c - saved_supp)
    dc = abs(conf_c - saved_conf)
    dl = abs(lift_c - saved_lift)
    
    max_supp_diff = max(max_supp_diff, ds)
    max_conf_diff = max(max_conf_diff, dc)
    max_lift_diff = max(max_lift_diff, dl)
    
    # Rounding tolerance: 4 decimals means diff <= 0.0001
    if ds > 0.0001 or dc > 0.0001 or dl > 0.0002:
        mismatches += 1
        if mismatches <= 3:
            print(f"Mismatch in rule {i}:")
            print(f"  ant: {ant}  con: {con}")
            print(f"  joint={joint}, ant_c={ant_c}, con_c={con_c}, N={N}")
            print(f"  Saved:    supp={saved_supp:.6f} conf={saved_conf:.6f} lift={saved_lift:.6f}")
            print(f"  Computed: supp={supp_c:.6f} conf={conf_c:.6f} lift={lift_c:.6f}")

print(f"\n=== Association rule arithmetic verification ({len(rules)} rules) ===")
print(f"Max support diff:    {max_supp_diff:.6f}")
print(f"Max confidence diff: {max_conf_diff:.6f}")
print(f"Max lift diff:       {max_lift_diff:.6f}")
print(f"Rules with diff > rounding tolerance: {mismatches}  {'PASS' if mismatches == 0 else 'CHECK TOLERANCE'}")

# First rule concrete verification
r0 = rules[0]
ant0 = frozenset(r0["antecedent"] if isinstance(r0["antecedent"], list) else [r0["antecedent"]])
con0 = frozenset(r0["consequent"] if isinstance(r0["consequent"], list) else [r0["consequent"]])
j0 = sum(1 for t in qualifying_transactions if ant0 <= t and con0 <= t)
a0 = sum(1 for t in qualifying_transactions if ant0 <= t)
c0 = sum(1 for t in qualifying_transactions if con0 <= t)
print(f"\n=== Concrete verification of Rule 0 ===")
print(f"Antecedent: {r0['antecedent']}")
print(f"Consequent: {r0['consequent']}")
print(f"N = {N}")
print(f"antecedent count = {a0}")
print(f"consequent count = {c0}")
print(f"joint count = {j0}")
computed_lift = (j0 * N) / (a0 * c0)
print(f"lift = {j0} * {N} / ({a0} * {c0}) = {computed_lift:.6f}")
print(f"saved lift = {r0['lift']:.4f}")
print(f"diff = {abs(computed_lift - r0['lift']):.6f}")

print("\nDone.")

