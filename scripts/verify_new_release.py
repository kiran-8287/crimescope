"""Verify new release SQLite has correct benchmark values and counts."""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"

conn = sqlite3.connect(DB)
cur = conn.cursor()

print("=== 2024 Classification Counts ===")
cur.execute("""
    SELECT region_type, COUNT(DISTINCT geography_id) as cnt
    FROM crime_observations
    WHERE year = 2024
    GROUP BY region_type
    ORDER BY cnt DESC
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

print("\n=== Benchmark: Anjaw Rape 2024 (expect 0) ===")
cur.execute("""
    SELECT reported_value
    FROM crime_observations
    WHERE state_name='Arunachal Pradesh'
      AND region_name='Anjaw'
      AND year=2024
      AND original_category LIKE '%Rape%'
    LIMIT 5
""")
rows = cur.fetchall()
if rows:
    vals = [r[0] for r in rows]
    print(f"  Values: {vals} — {'PASS' if all(v == 0 for v in vals) else 'FAIL'}")
else:
    print("  No rows found — check query")

print("\n=== Benchmark: Anantapuramu Murder 2024 (expect 62) ===")
cur.execute("""
    SELECT reported_value, original_category
    FROM crime_observations
    WHERE state_name='Andhra Pradesh'
      AND region_name='Anantapuramu'
      AND year=2024
      AND original_category LIKE '%Murder%'
      AND original_category NOT LIKE '%Attempt%'
    LIMIT 5
""")
rows = cur.fetchall()
for r in rows:
    print(f"  {r[1]}: {r[0]} — {'PASS' if r[0] == 62 else 'FAIL (expected 62)'}")

print("\n=== Total rows in DB ===")
cur.execute("SELECT COUNT(*) FROM crime_observations")
print(f"  {cur.fetchone()[0]:,}")

print("\n=== Years present ===")
cur.execute("SELECT year, COUNT(*) FROM crime_observations GROUP BY year ORDER BY year")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,} rows")

print("\n=== Admin districts count in serving current.json ===")
import json
with open("data/serving/current.json") as f:
    cur_json = json.load(f)
print(f"  Active release: {cur_json['release_id']}")

print("\n=== Run current.json ===")
with open("analysis/output/runs/current.json") as f:
    run_json = json.load(f)
print(f"  Active run: {run_json['run_id']}")

conn.close()
print("\nDone.")

