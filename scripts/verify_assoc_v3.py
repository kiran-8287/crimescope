"""
Task 3: Verify association-rule arithmetic for v3 (744 transactions, 708 rules).
Recompute support, confidence, lift from the underlying transactions.
Check for parent-child rules using taxonomy.
"""
import json, math, itertools

RUN_DIR = "analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3"
RULES_FILE = f"{RUN_DIR}/association/association_rules_2024.json"
MANIFEST_FILE = f"{RUN_DIR}/run_manifest.json"
HIER_FILE = "config/category_hierarchy.json"

data = json.load(open(RULES_FILE))
manifest = json.load(open(MANIFEST_FILE))

rules = data.get("rules", [])
transactions_raw = data.get("transactions", [])  # list of sets / lists of category ids
n_transactions = data.get("n_transactions", 0)

print(f"n_transactions from artifact: {n_transactions}")
print(f"n_rules: {len(rules)}")
print(f"Transactions actually stored: {len(transactions_raw)}")

# Rebuild itemsets from transactions
transactions = [frozenset(t) for t in transactions_raw]
N = len(transactions)
print(f"Transactions rebuilt: {N}")

# Count support for each item
item_counts = {}
for t in transactions:
    for item in t:
        item_counts[item] = item_counts.get(item, 0) + 1

# Verify a sample of rules
print(f"\n=== Rule arithmetic verification (sample of first 10 and last 10) ===")
errors = []
max_lift_diff = 0.0
max_supp_diff = 0.0
max_conf_diff = 0.0

sample_indices = list(range(min(10, len(rules)))) + list(range(max(0, len(rules)-10), len(rules)))
sample_indices = sorted(set(sample_indices))

for i in sample_indices:
    rule = rules[i]
    ant = frozenset(rule["antecedent"]) if isinstance(rule["antecedent"], list) else frozenset([rule["antecedent"]])
    con = frozenset(rule["consequent"]) if isinstance(rule["consequent"], list) else frozenset([rule["consequent"]])
    
    saved_supp = rule.get("support", rule.get("supportCount", 0) / N if "supportCount" in rule else None)
    saved_conf = rule.get("confidence", None)
    saved_lift = rule.get("lift", None)
    supp_count = rule.get("supportCount", None)
    ant_count = rule.get("antecedentCount", None)
    con_count = rule.get("consequentCount", None)
    
    # Recompute
    joint = sum(1 for t in transactions if ant <= t and con <= t)
    ant_c = sum(1 for t in transactions if ant <= t)
    con_c = sum(1 for t in transactions if con <= t)
    
    r_supp = joint / N
    r_conf = joint / ant_c if ant_c > 0 else 0
    r_lift = (joint * N) / (ant_c * con_c) if ant_c > 0 and con_c > 0 else 0
    
    if saved_supp is not None:
        ds = abs(r_supp - saved_supp)
        max_supp_diff = max(max_supp_diff, ds)
        if ds > 0.001:
            errors.append(f"Rule {i}: support diff={ds:.4f}")
    if saved_conf is not None:
        dc = abs(r_conf - saved_conf)
        max_conf_diff = max(max_conf_diff, dc)
        if dc > 0.001:
            errors.append(f"Rule {i}: confidence diff={dc:.4f}")
    if saved_lift is not None:
        dl = abs(r_lift - saved_lift)
        max_lift_diff = max(max_lift_diff, dl)
        if dl > 0.001:
            errors.append(f"Rule {i}: lift diff={dl:.4f}")

print(f"Max support diff:    {max_supp_diff:.6f}")
print(f"Max confidence diff: {max_conf_diff:.6f}")
print(f"Max lift diff:       {max_lift_diff:.6f}")
print(f"Errors (>0.001): {len(errors)}")
if errors:
    for e in errors[:5]: print(f"  {e}")

# Verify ALL rules
print(f"\n=== Verifying all {len(rules)} rules ===")
all_errors = 0
for rule in rules:
    ant = frozenset(rule["antecedent"]) if isinstance(rule["antecedent"], list) else frozenset([rule["antecedent"]])
    con = frozenset(rule["consequent"]) if isinstance(rule["consequent"], list) else frozenset([rule["consequent"]])
    saved_lift = rule.get("lift")
    if saved_lift is None: continue
    joint = sum(1 for t in transactions if ant <= t and con <= t)
    ant_c = sum(1 for t in transactions if ant <= t)
    con_c = sum(1 for t in transactions if con <= t)
    r_lift = (joint * N) / (ant_c * con_c) if ant_c > 0 and con_c > 0 else 0
    if abs(r_lift - saved_lift) > 0.0001:
        all_errors += 1

print(f"Rules with lift diff > 0.0001: {all_errors}  {'PASS' if all_errors == 0 else 'FAIL'}")

# Document empty-transaction exclusion
print(f"\n=== Empty transaction documentation ===")
print(f"Cohort size: 783 administrative districts")
print(f"Transactions (>=1 qualifying item): {N}")
print(f"Excluded (0 qualifying items): {783 - N}")
print(f"Reference population for support/confidence/lift: N = {N}")
print(f"Support values are conditional on a qualifying transaction existing.")

# Parent-child rule check (using category hierarchy if available)
import os
if os.path.exists(HIER_FILE):
    hier = json.load(open(HIER_FILE))
    print(f"\n=== Parent-child rule check ===")
    # Build child->parent map
    parent_of = {}
    def build_map(node, parent_id=None):
        nid = node.get("id") or node.get("category_id")
        if parent_id and nid:
            parent_of[nid] = parent_id
        for child in node.get("children", []):
            build_map(child, nid)
    if isinstance(hier, list):
        for root in hier:
            build_map(root)
    else:
        build_map(hier)
    
    pc_rules = []
    for rule in rules:
        ant = rule["antecedent"] if isinstance(rule["antecedent"], list) else [rule["antecedent"]]
        con = rule["consequent"] if isinstance(rule["consequent"], list) else [rule["consequent"]]
        for a in ant:
            for c in con:
                if parent_of.get(a) == c or parent_of.get(c) == a:
                    pc_rules.append(rule)
    print(f"Parent-child rules found: {len(pc_rules)}")
    if pc_rules:
        for r in pc_rules[:3]:
            print(f"  ant={r['antecedent']} -> con={r['consequent']} lift={r.get('lift','?'):.3f}")
else:
    print(f"\nHierarchy file not found at {HIER_FILE}, skipping parent-child check")
    # Try alternate path
    for path in ["analysis/config/category_hierarchy.json", "data/config/category_hierarchy.json"]:
        if os.path.exists(path):
            print(f"  Found at: {path}")
            break

print("\nDone.")

