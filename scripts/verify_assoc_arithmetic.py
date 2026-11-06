"""
Verify association-rule arithmetic by rebuilding transactions from feature_input.csv:
Qualification threshold: total >= 10 cases.
Drop empty transactions -> N transactions.
Recompute support, confidence, lift for each rule and assert agreement.
"""
import json, csv, math
from collections import defaultdict

RUN_DIR = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3"
RULES_FILE = f"{RUN_DIR}/association/association_rules_2024.json"
FEAT_FILE = f"{RUN_DIR}/feature_input.csv"

data = json.load(open(RULES_FILE))
rules = data["rules"]
expected_N = data["n_transactions"]

print(f"Artifact n_transactions: {expected_N}")
print(f"Artifact n_rules: {len(rules)}")

# Rebuild transactions from feature_input.csv
# A transaction = set of category_ids with total >= 10 in a given region
region_items = defaultdict(set)
with open(FEAT_FILE, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        val = float(row["total"] or 0)
        if val >= 10:
            region_items[row["region_id"]].add(row["category_id"])

# Drop empty transactions (regions with 0 qualifying items)
qualifying_transactions = [items for items in region_items.values() if items]
N = len(qualifying_transactions)

print(f"Total regions in feature file: {len(set(r['region_id'] for r in csv.DictReader(open(FEAT_FILE))))}")
print(f"Qualifying transactions (>= 1 item >= 10): {N} (expected {expected_N})")
assert N == expected_N, f"Rebuilt transactions {N} != expected {expected_N}"

# Check sample rule
sample = rules[0]
print(f"\nSample rule keys: {list(sample.keys())}")
print(f"Sample rule: {sample}")

# Verify arithmetic on all rules
max_supp_diff = 0.0
max_conf_diff = 0.0
max_lift_diff = 0.0
mismatches = 0

for i, rule in enumerate(rules):
    # Rule format: antecedent, consequent can be lists or strings
    ant = rule["antecedent"]
    con = rule["consequent"]
    ant_set = frozenset(ant if isinstance(ant, list) else [ant])
    con_set = frozenset(con if isinstance(con, list) else [con])
    
    # Counts in transactions
    joint = sum(1 for t in qualifying_transactions if ant_set <= t and con_set <= t)
    ant_c = sum(1 for t in qualifying_transactions if ant_set <= t)
    con_c = sum(1 for t in qualifying_transactions if con_set <= t)
    
    supp_c = joint / N
    conf_c = joint / ant_c if ant_c > 0 else 0
    lift_c = (joint * N) / (ant_c * con_c) if (ant_c > 0 and con_c > 0) else 0
    
    # Check against stored values
    saved_supp = rule.get("support", 0)
    saved_conf = rule.get("confidence", 0)
    saved_lift = rule.get("lift", 0)
    
    ds = abs(supp_c - saved_supp)
    dc = abs(conf_c - saved_conf)
    dl = abs(lift_c - saved_lift)
    
    max_supp_diff = max(max_supp_diff, ds)
    max_conf_diff = max(max_conf_diff, dc)
    max_lift_diff = max(max_lift_diff, dl)
    
    if ds > 0.0001 or dc > 0.0001 or dl > 0.0001:
        mismatches += 1
        if mismatches <= 3:
            print(f"Mismatch in rule {i}:")
            print(f"  Saved:    supp={saved_supp:.6f} conf={saved_conf:.6f} lift={saved_lift:.6f}")
            print(f"  Computed: supp={supp_c:.6f} conf={conf_c:.6f} lift={lift_c:.6f}")

print(f"\n=== Association rule arithmetic verification ({len(rules)} rules) ===")
print(f"Max support diff:    {max_supp_diff:.8f}")
print(f"Max confidence diff: {max_conf_diff:.8f}")
print(f"Max lift diff:       {max_lift_diff:.8f}")
print(f"Mismatches (> 0.0001): {mismatches}  {'PASS' if mismatches == 0 else 'FAIL'}")

# Verify lift formula: lift = joint * N / (ant_c * con_c)
print(f"\n=== Concrete arithmetic example (first rule) ===")
r0 = rules[0]
ant0 = frozenset(r0["antecedent"] if isinstance(r0["antecedent"], list) else [r0["antecedent"]])
con0 = frozenset(r0["consequent"] if isinstance(r0["consequent"], list) else [r0["consequent"]])
j0 = sum(1 for t in qualifying_transactions if ant0 <= t and con0 <= t)
a0 = sum(1 for t in qualifying_transactions if ant0 <= t)
c0 = sum(1 for t in qualifying_transactions if con0 <= t)
print(f"N = {N}")
print(f"antecedent count = {a0}")
print(f"consequent count = {c0}")
print(f"joint count = {j0}")
print(f"lift = {j0} * {N} / ({a0} * {c0}) = {(j0 * N) / (a0 * c0):.6f}")
print(f"saved lift = {r0['lift']:.6f}")
print(f"diff = {abs((j0*N)/(a0*c0) - r0['lift']):.8f}")

print("\nDone.")

