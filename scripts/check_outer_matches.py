"""
Check which units matched outer, dehat, grameen, etc.
"""
import sqlite3, re

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

cur.execute("""
    SELECT DISTINCT year, state_name, region_name, original_region_name
    FROM crime_observations
    WHERE comparison_status = 'eligible' AND region_type = 'administrative_district'
    ORDER BY year, state_name, region_name
""")
rows = cur.fetchall()
conn.close()

pats = [r"\bouter\b", r"\bdehat\b", r"\bgrameen\b"]
for yr, s, r, orig in rows:
    for pat in pats:
        if re.search(pat, orig.lower()):
            print(f"Year {yr}: [{s}] '{orig}' matched '{pat}'")

