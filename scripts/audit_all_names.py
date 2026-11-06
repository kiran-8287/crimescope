"""
Examine all distinct region names across all states currently classified as administrative_district.
Print any that don't match typical revenue district naming.
"""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

cur.execute("""
    SELECT state_name, region_name, GROUP_CONCAT(DISTINCT year)
    FROM crime_observations
    WHERE region_type = 'administrative_district'
    GROUP BY state_name, region_name
    ORDER BY state_name, region_name
""")

rows = cur.fetchall()
print(f"Total state x region combos: {len(rows)}")

# Check for any names with words like:
# 'rly', 'police', 'stn', 'branch', 'bureau', 'cell', 'unit', 'crime', 'special', 'cid', 'range'
for state, region, years in rows:
    l = region.lower()
    for w in ['rly', 'police', 'stn', 'branch', 'bureau', 'cell', 'unit', 'crime', 'special', 'cid', 'range', 'board', 'corp', 'central', 'zone']:
        if w in l and l not in ['bengaluru rural', 'bangalore rural']:
            print(f"  [{state}] {region} ({years}) matched '{w}'")
            break

conn.close()

