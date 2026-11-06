"""
Inspect W.Rly Ahmedabad, W.Rly Vadodara, Kerala All Districts, Nagaland Crime
in the current SQLite database and raw sources.
"""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

targets = [
    ('Gujarat', '%W%Rly%'),
    ('Kerala', '%All Districts%'),
    ('Nagaland', '%Crime%'),
]

print("=== TARGET UNITS IN SERVING DATABASE ===")
for state, pattern in targets:
    cur.execute("""
        SELECT DISTINCT year, state_name, region_name, original_region_name, region_type, source_id, source_row_reference
        FROM crime_observations
        WHERE state_name = ? AND original_region_name LIKE ?
        ORDER BY year, region_name
    """, (state, pattern))
    rows = cur.fetchall()
    print(f"\nState: {state}, Pattern: {pattern}")
    for r in rows:
        print(f"  Year {r[0]}: region='{r[1]}' orig='{r[3]}' type='{r[4]}' source='{r[5]}' row_ref={r[6]}")

conn.close()

