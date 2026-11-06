"""
Audit full canonical reclassification with the complete set of audited rules.
"""
import sqlite3, re
from collections import defaultdict

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
EXPLICIT_ADMINISTRATIVE_DISTRICTS = {"bengaluru rural", "bangalore rural", "kanpur dehat"}

REGION_ACRONYMS = {
    "railway": [
        r"\bgrp\b", r"\bsrp\b", r"\brly\b", r"\bw\.?\s*rly\b",
        r"\brailway\b", r"\brailways\b", r"\bk\.?\s*railways?\b"
    ],
    "city_police": [r"\bcommr\b", r"\bcommissionarate\b", r"\bdcp\b", r"\bcp\b"],
    "other_police_unit": [
        r"\brural\b", r"\bstf\b", r"\beow\b", r"\brpo\b", r"\bsou\b", r"\bssb\b",
        r"\bk\.?g\.?f\.?\b", r"\bcid\b", r"\bcrime branch\b", r"\bcyber\b",
        r"\bspecial task force\b", r"\beconomic offences\b", r"\banti narcotic\b",
        r"\bcrime wing\b", r"\bcrime and eou\b", r"\bigi airport\b", r"\bairport\b",
        r"\bspl cell\b", r"\bvigilance\b", r"\bbureau of investigation\b",
        r"\banti terrorist squad\b", r"\bpolice district\b", r"\bpolice dist\b",
        r"\bpolice\b", r"\bother units\b",
        r"\bcrime\b", r"\bnarcotic\b", r"\bnarcotics\b", r"\ball districts\b",
        r"\bsog\b", r"\bats\b", r"\bkanpur outer\b", r"\blucknow grameen\b",
        r"\bvasanasi dehat\b", r"\bvaranasi dehat\b"
    ]
}

def classify(name: str) -> str:
    lower = name.lower().strip()
    if lower in TOTAL_TOKENS or lower == "": return "aggregate"
    if lower in EXPLICIT_ADMINISTRATIVE_DISTRICTS: return "administrative_district"
    if "railway" in lower: return "railway"
    for pat in REGION_ACRONYMS["railway"]:
        if re.search(pat, lower): return "railway"
    if any(token in lower for token in ("city", "urban", "commissionerate", "metro")): return "city_police"
    for pat in REGION_ACRONYMS["city_police"]:
        if re.search(pat, lower): return "city_police"
    for pat in REGION_ACRONYMS["other_police_unit"]:
        if re.search(pat, lower): return "other_police_unit"
    return "administrative_district"

by_year = defaultdict(lambda: defaultdict(set))
changed = []
for yr, s, r, orig, gid, old_type in rows:
    new_type = classify(orig)
    by_year[yr][new_type].add(gid)
    if old_type != new_type:
        changed.append((yr, s, orig, old_type, new_type))

print("=== FINAL RECLASSIFICATION AUDIT RESULTS ===")
for yr in sorted(by_year.keys()):
    print(f"\nYear {yr}:")
    for t, ids in sorted(by_year[yr].items()):
        print(f"  {t}: {len(ids)}")

print(f"\nTotal changed records across all years: {len(changed)}")
for c in changed:
    print(f"  {c[0]}: [{c[1]}] '{c[2]}' -> was {c[3]}, now {c[4]}")

