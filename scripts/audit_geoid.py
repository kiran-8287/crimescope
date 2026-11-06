import sqlite3

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()

cur.execute("SELECT year, geography_id, state_name, region_name FROM crime_observations WHERE region_name LIKE '%Anantapur%' GROUP BY year, region_name")
for r in cur.fetchall():
    print(r)

conn.close()

