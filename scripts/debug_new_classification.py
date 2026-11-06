import sqlite3
import sys
sys.path.insert(0, "analysis/src")
from crimescope_analysis.cleaning.canonical import classify_region

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()
cur.execute("SELECT geography_id, state_name, region_name, region_type FROM crime_observations WHERE year=2024 AND region_type != 'aggregate' GROUP BY geography_id")
rows = cur.fetchall()

counts = {}
for gid, state, name, old_type in rows:
    new_type = classify_region(name)
    counts[new_type] = counts.get(new_type, 0) + 1

print(f"Total: {len(rows)}")
print("By new_type on 964 units:", counts)
print("Sum of new_type counts:", sum(counts.values()))
conn.close()

