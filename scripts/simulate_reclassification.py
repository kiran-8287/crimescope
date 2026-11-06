"""
Simulate updated classification on all units across all years.
Show exact counts for each year before and after.
"""
import sqlite3, re

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

cur.execute("""
    SELECT DISTINCT year, state_name, region_name, original_region_name, geography_id, region_type
    FROM crime_observations
    WHERE comparison_status = 'eligible' AND region_type != 'aggregate'
    ORDER BY year, state_name, region_name
""")
rows = cur.fetchall()
conn.close()

TOTAL_TOKENS = {"total districts", "total", "total districts ", "total districts\t"}
EXPLICIT_ADMINISTRATIVE_DISTRICTS = {"bengaluru rural", "bangalore rural"}

REGION_ACRONYMS = {
    "railway": [r"\bgrp\b", r"\bsrp\b", r"\brly\b", r"\brailway\b", r"\brailways\b"],
    "city_police": [r"\bcommr\b", r"\bcommissionarate\b", r"\bdcp\b", r"\bcp\b"],
    "other_police_unit": [
        r"\brural\b", r"\bstf\b", r"\beow\b", r"\brpo\b", r"\bsou\b", r"\bssb\b",
        r"\bkgf\b", r"\bcid\b", r"\bcrime branch\b", r"\bcyber\b",
        r"\bspecial task force\b", r"\beconomic offences\b", r"\banti narcotic\b",
        r"\bcrime wing\b", r"\bcrime and eou\b", r"\bigi airport\b", r"\bairport\b",
        r"\bspl cell\b", r"\bvigilance\b", r"\bbureau of investigation\b",
        r"\banti terrorist squad\b", r"\bpolice district\b", r"\bpolice dist\b",
        r"\bpolice\b", r"\bother units\b",
        r"\bcrime\b", r"\bnarcotic\b", r"\bnarcotics\b", r"\ball districts\b"
    ]
}

def classify(name: str) -> str:
    lower = name.lower().strip()
    if lower in TOTAL_TOKENS or lower == "":
        return "aggregate"
    if lower in EXPLICIT_ADMINISTRATIVE_DISTRICTS:
        return "administrative_district"
    if "railway" in lower:
        return "railway"
    for pat in REGION_ACRONYMS["railway"]:
        if re.search(pat, lower):
            return "railway"
    if any(token in lower for token in ("city", "urban", "commissionerate", "metro")):
        return "city_police"
    for pat in REGION_ACRONYMS["city_police"]:
        if re.search(pat, lower):
            return "city_police"
    for pat in REGION_ACRONYMS["other_police_unit"]:
        if re.search(pat, lower):
            return "other_police_unit"
    return "administrative_district"

from collections import defaultdict
by_year_old = defaultdict(lambda: defaultdict(set))
by_year_new = defaultdict(lambda: defaultdict(set))
changed_units = []

for yr, s, r, orig, gid, old_type in rows:
    by_year_old[yr][old_type].add(gid)
    new_type = classify(orig)
    by_year_new[yr][new_type].add(gid)
    if old_type != new_type:
        changed_units.append((yr, s, r, orig, old_type, new_type))

print("=== RECLASSIFICATION SUMMARY BY YEAR ===")
for yr in sorted(by_year_old.keys()):
    print(f"\n--- Year {yr} ---")
    print("  OLD:")
    for t, ids in sorted(by_year_old[yr].items()):
        print(f"    {t}: {len(ids)}")
    print("  NEW:")
    for t, ids in sorted(by_year_new[yr].items()):
        print(f"    {t}: {len(ids)}")

print(f"\nTotal changed units: {len(changed_units)}")
for c in changed_units:
    print(f"  Year {c[0]}: [{c[1]}] '{c[3]}' -> was '{c[4]}', now '{c[5]}'")

