"""
Comprehensive audit of all region names across all years (2020-2024).
List all distinct (state, region_name, original_region_name, year) currently classified as administrative_district.
Check which ones match non-district patterns or are suspicious.
"""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

cur.execute("""
    SELECT DISTINCT year, state_name, region_name, original_region_name
    FROM crime_observations
    WHERE region_type = 'administrative_district'
    ORDER BY state_name, region_name, year
""")

rows = cur.fetchall()
print(f"Total distinct (year, state, region, orig) in administrative_district: {len(rows)}")

# Group by state and region_name
by_name = {}
for y, s, r, orig in rows:
    by_name.setdefault((s, r), set()).add((y, orig))

suspicious_tokens = [
    "rly", "rail", "commr", "cp", "dcp", "cid", "crime", "cyber", "cell", "eow",
    "stf", "special", "airport", "all district", "other", "srp", "grp", "bureau",
    "vigilance", "traffic", "narcotic", "security", "headquarter", "hq", "ps", "range"
]

print("\n=== SUSPICIOUS UNITS CURRENTLY CLASSIFIED AS ADMINISTRATIVE_DISTRICT ===")
found_suspicious = []
for (s, r), yr_origs in sorted(by_name.items()):
    lower_r = r.lower()
    lower_origs = " ".join(orig.lower() for _, orig in yr_origs)
    text = f"{lower_r} {lower_origs}"
    
    # Exceptions that are known valid administrative districts:
    if lower_r in ["bengaluru rural", "bangalore rural"]:
        continue
        
    matched = [tok for tok in suspicious_tokens if tok in text]
    if matched:
        years = sorted(list(set(y for y, _ in yr_origs)))
        origs = sorted(list(set(orig for _, orig in yr_origs)))
        print(f"State: {s:<20} Region: {r:<25} Matched: {matched}  Years: {years}  OrigNames: {origs}")
        found_suspicious.append((s, r, matched, years, origs))

print(f"\nTotal suspicious units found: {len(found_suspicious)}")
conn.close()

