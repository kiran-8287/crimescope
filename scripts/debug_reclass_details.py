import sqlite3
import sys
sys.path.insert(0, "analysis/src")
from crimescope_analysis.cleaning.canonical import classify_region

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()
cur.execute("SELECT geography_id, state_name, region_name, region_type FROM crime_observations WHERE year=2024 AND region_type != 'aggregate' GROUP BY geography_id")
rows = cur.fetchall()

mismatches = []
for gid, state, name, old_type in rows:
    new_type = classify_region(name)
    if new_type != old_type:
        mismatches.append((gid, state, name, old_type, new_type))

print(f"Total units in 2024: {len(rows)}")
print(f"Total reclassified units in 2024: {len(mismatches)}")
from collections import Counter
print("Transitions (old -> new):", Counter((m[3], m[4]) for m in mismatches))
conn.close()

