import sqlite3
import json

db_path = "A:/Projects/crimescope/data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check region types in 2024
cur.execute("SELECT region_type, COUNT(DISTINCT geography_id) FROM crime_observations WHERE year=2024 GROUP BY region_type")
print("2024 Distinct regions by region_type:", cur.fetchall())

# Let's inspect all regions marked administrative_district in 2024
cur.execute("SELECT DISTINCT state_name, region_name FROM crime_observations WHERE year=2024 AND region_type='administrative_district' ORDER BY state_name, region_name")
admin_regions = cur.fetchall()
print(f"Total admin_district in 2024: {len(admin_regions)}")

keywords = [
    "rural", "dcp", "srp", "police", "comm", "ctc", "range", "traffic", 
    "special", "unit", "division", "sec", "zone", "coastal", "marine", 
    "sub-div", "security", "cid", "branch", "crime", "stf", "railway", 
    "anti", "task", "cell", "hq", "headquarters", "battalion", "corridor",
    "bureau", "vigilance", "enforcement", "harbour", "harbor", "port",
    "expressway", "metro", "commissionerate", "north-east", "north east"
]

flagged = []
for state, region in admin_regions:
    r_lower = region.lower()
    matches = [kw for kw in keywords if kw in r_lower]
    if matches or len(region) <= 3:
        flagged.append((state, region, matches))

print(f"Flagged non-administrative candidates: {len(flagged)}")
for state, region, matches in flagged:
    print(f"  [{state}] '{region}' (matched: {matches})")

conn.close()

