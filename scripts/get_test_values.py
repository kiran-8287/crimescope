"""Get actual values from the new release to update test assertions."""
import sqlite3, json

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

# 1. Total observations
cur.execute("SELECT COUNT(*) FROM crime_observations")
print(f"Total observations: {cur.fetchone()[0]:,}")

# 2. Explicit zeros
cur.execute("SELECT COUNT(*) FROM crime_observations WHERE reported_value = 0")
print(f"Explicit zeros: {cur.fetchone()[0]:,}")

# 3. Grand total (official_total) for 2024, all admin districts
cur.execute("""
    SELECT SUM(reported_value)
    FROM crime_observations
    WHERE year = 2024
      AND original_category LIKE '%Total IPC%'
       OR (year = 2024 AND original_category LIKE '%Total BNS%')
    LIMIT 1
""")

# Actually get the grand total through the overview query pattern used by the backend
# Check what category is used as official_total
cur.execute("""
    SELECT DISTINCT original_category, feature_role
    FROM crime_observations
    WHERE year = 2024
      AND feature_role = 'official_total'
    LIMIT 10
""")
rows = cur.fetchall()
print(f"\nOfficial total categories: {rows}")

cur.execute("""
    SELECT SUM(reported_value)
    FROM crime_observations
    WHERE year = 2024
      AND feature_role = 'official_total'
      AND region_type = 'administrative_district'
""")
val = cur.fetchone()[0]
print(f"Grand total 2024 admin districts official_total: {val:,}")

cur.execute("""
    SELECT COUNT(DISTINCT geography_id)
    FROM crime_observations
    WHERE year = 2024
      AND feature_role = 'official_total'
      AND region_type = 'administrative_district'
""")
units = cur.fetchone()[0]
print(f"Units with official_total 2024: {units}")

# Get run manifest for nTransactions and nRules
print("\n=== Run manifest values ===")
with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3/run_manifest.json") as f:
    rm = json.load(f)
print(f"nTransactions: {rm.get('association', {}).get('n_transactions', 'N/A')}")
print(f"nRules: {rm.get('association', {}).get('n_rules', 'N/A')}")
print(f"PCA variance[0]: {rm.get('pca', {}).get('explained_variance_ratio', [None])[0]}")
print(f"n_regions: {rm.get('n_regions', 'N/A')}")

# Matched units 2022-2023 (from new interim CSV)
import csv
print("\n=== Checking interim staging manifest ===")
with open("data/interim/expanded_national_2021_2024/staging_release_manifest.json") as f:
    sm = json.load(f)
print(json.dumps(sm, indent=2)[:2000])

conn.close()

