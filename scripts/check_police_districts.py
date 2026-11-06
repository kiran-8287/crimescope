"""
Check SOG, ATS & SOG, K.G.F., Kanpur Outer, Lucknow Grameen, Varanasi Dehat across years.
"""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

names = ['SOG', 'ATS & SOG', 'K.G.F.', 'Kanpur Outer', 'Lucknow Grameen', 'Vasanasi Dehat', 'Varanasi Dehat']
for n in names:
    cur.execute("""
        SELECT DISTINCT year, state_name, region_name, original_region_name
        FROM crime_observations
        WHERE region_name LIKE ? OR original_region_name LIKE ?
        ORDER BY year
    """, (f"%{n}%", f"%{n}%"))
    rows = cur.fetchall()
    print(f"\nPattern '{n}':")
    for r in rows:
        print(f"  {r[0]}: [{r[1]}] '{r[2]}' (orig: '{r[3]}')")

conn.close()

