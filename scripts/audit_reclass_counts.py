import sqlite3
import sys
sys.path.insert(0, "analysis/src")
from crimescope_analysis.cleaning.canonical import classify_region

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()
cur.execute("SELECT DISTINCT year, region_name FROM crime_observations WHERE region_type != 'aggregate'")
rows = cur.fetchall()

counts = {}
for y, name in rows:
    counts.setdefault(y, {}).setdefault(classify_region(name), set()).add(name)

for y in sorted(counts.keys()):
    print(f"Year {y}:", {k: len(v) for k, v in counts[y].items()})
conn.close()

