"""Get remaining test values."""
import sqlite3, json

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

print("=== Grand total 2024 admin districts (official_total category) ===")
cur.execute("""
    SELECT SUM(reported_value), COUNT(DISTINCT geography_id)
    FROM crime_observations
    WHERE year=2024
      AND region_type='administrative_district'
      AND mapped_category_id='50920ae7b610c017c4ae1410'
""")
r = cur.fetchone()
print(f"  Total cases: {r[0]:,}")
print(f"  Units: {r[1]}")

conn.close()

print("\n=== Run manifest methods section ===")
with open("analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261106-v3/run_manifest.json") as f:
    rm = json.load(f)

methods = rm.get('methods', {})
cohort = rm.get('cohort', {})
print(f"  cohort: {json.dumps(cohort, indent=2)}")

for method_name, method_data in methods.items():
    print(f"\n  [{method_name}]")
    if isinstance(method_data, dict):
        for k, v in method_data.items():
            if not isinstance(v, (list, dict)) or (isinstance(v, list) and len(v) < 5):
                print(f"    {k}: {v}")
            elif isinstance(v, list):
                print(f"    {k}: [{v[0]}, ...] (len={len(v)})")

