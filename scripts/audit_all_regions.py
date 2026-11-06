import sqlite3
import csv
from collections import defaultdict

db_path = "data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get all unique (year, state_name, region_name, region_type)
cur.execute("SELECT DISTINCT year, state_name, region_name, region_type FROM crime_observations ORDER BY state_name, region_name, year")
rows = cur.fetchall()

print(f"Total distinct (year, state, region, type) tuples: {len(rows)}")

# Let's see non-aggregate units
units = defaultdict(dict)
for year, state, region, r_type in rows:
    if r_type == "aggregate":
        continue
    units[(state, region)][year] = r_type

print(f"Total distinct reporting units: {len(units)}")

# Find all units that have names indicative of police, railway, commissionerate, range, rural, or other non-revenue district units
suspects = []
for (state, region), year_types in sorted(units.items()):
    r_lower = region.lower().strip()
    # Check if any year was classified as administrative_district
    has_admin = any(t == "administrative_district" for t in year_types.values())
    
    # tokens to check
    reasons = []
    if any(k in r_lower for k in ["commr", "commissionarate", "commissionerate", "cp ", "cp-", "dcp"]):
        reasons.append("commissionerate/dcp")
    if any(k in r_lower for k in ["railway", "grp", "srp"]):
        reasons.append("railway_police")
    if any(k in r_lower for k in ["crime branch", "cyber", "cid", "stf", "special", "task force", "vigilance", "anti", "eow", "bureau", "cell", "rpo", "sou", "ssb", "security"]):
        reasons.append("specialized_police_unit")
    if any(k in r_lower for k in ["police district", "police distt", "baruipur police", "diamond harbour police", "sundarban police", "hooghly rural police", "jangipur police", "murshidabad police"]):
        reasons.append("police_district")
    if "rural" in r_lower:
        reasons.append("rural_police_unit")
    if any(k in r_lower for k in ["range", "zone", "corridor"]):
        reasons.append("police_range_or_zone")
        
    if has_admin and reasons:
        suspects.append((state, region, reasons, year_types))

print(f"\nSuspect administrative_district units: {len(suspects)}")
for s, r, reasons, yt in suspects:
    print(f"[{s}] '{r}': {', '.join(reasons)} | years: {list(yt.keys())}")

conn.close()

