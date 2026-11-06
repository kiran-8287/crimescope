import sqlite3

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()
cur.execute("SELECT geography_id, state_name, region_name, region_type FROM crime_observations WHERE year=2024 AND region_type != 'aggregate' GROUP BY geography_id")
rows = cur.fetchall()
print(f"Total non-aggregate units in 2024: {len(rows)}")
by_type = {}
for r in rows:
    by_type[r[3]] = by_type.get(r[3], 0) + 1
print("By stored region_type:", by_type)
conn.close()

