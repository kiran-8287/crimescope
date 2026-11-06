"""Get actual values from new release for test assertions."""
import sqlite3, json

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

print("=== Total observations ===")
cur.execute("SELECT COUNT(*) FROM crime_observations")
print(f"  {cur.fetchone()[0]:,}")

print("\n=== Explicit zeros ===")
cur.execute("SELECT COUNT(*) FROM crime_observations WHERE reported_value = 0")
print(f"  {cur.fetchone()[0]:,}")

print("\n=== Distinct category sample (to find official total) ===")
cur.execute("SELECT DISTINCT original_category FROM crime_observations WHERE year=2024 AND region_type='administrative_district' ORDER BY original_category LIMIT 30")
for r in cur.fetchall():
    print(f"  {r[0]}")

print("\n=== All distinct mapped_category_id patterns that look like totals ===")
cur.execute("""
    SELECT DISTINCT mapped_category_id, original_category
    FROM crime_observations
    WHERE year=2024
      AND region_type='administrative_district'
      AND (original_category LIKE '%Total%' OR original_category LIKE '%TOTAL%')
    ORDER BY mapped_category_id
    LIMIT 30
""")
for r in cur.fetchall():
    print(f"  [{r[0]}] {r[1]}")

print("\n=== Run manifest ===")
with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3/run_manifest.json") as f:
    rm = json.load(f)

assoc = rm.get('association', {})
pca = rm.get('pca', {})
print(f"  n_regions: {rm.get('n_regions', 'N/A')}")
print(f"  pca explained_variance_ratio[0]: {pca.get('explained_variance_ratio', [None])[0]}")
print(f"  association n_transactions: {assoc.get('n_transactions', 'N/A')}")
print(f"  association n_rules: {assoc.get('n_rules', 'N/A')}")
print(f"  Run manifest top-level keys: {list(rm.keys())}")

conn.close()

