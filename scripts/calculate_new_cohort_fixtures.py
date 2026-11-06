"""
Calculate the new 2022-2023 matched cohort with the updated classification:
"""
import sqlite3, re

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

cur.execute("""
    SELECT year, state_name, region_name, original_region_name, geography_id, reported_value
    FROM crime_observations
    WHERE mapped_category_id = '50920ae7b610c017c4ae1410'
      AND comparison_status = 'eligible' AND region_type != 'aggregate'
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

# Filter to administrative_district in 2022 and 2023 under new classification
units_2022 = {}
units_2023 = {}
values_2022 = {}
values_2023 = {}

for yr, s, r, orig, gid, val in rows:
    t = classify(orig)
    if t == "administrative_district":
        k = f"{s}|{r}"
        if yr == 2022:
            units_2022[k] = gid
            values_2022[k] = val or 0
        elif yr == 2023:
            units_2023[k] = gid
            values_2023[k] = val or 0

common_keys = set(units_2022.keys()) & set(units_2023.keys())
only_2022 = set(units_2022.keys()) - common_keys
only_2023 = set(units_2023.keys()) - common_keys

matched_2022_sum = sum(values_2022[k] for k in common_keys)
matched_2023_sum = sum(values_2023[k] for k in common_keys)
excl_2022_sum = sum(values_2022[k] for k in only_2022)
excl_2023_sum = sum(values_2023[k] for k in only_2023)
annual_2022_sum = sum(values_2022.values())
annual_2023_sum = sum(values_2023.values())

print("=== NEW 2022-2023 MATCHED COHORT FIXTURES ===")
print(f"2022 Admin units count: {len(units_2022)}")
print(f"2023 Admin units count: {len(units_2023)}")
print(f"Matched count: {len(common_keys)}")
print(f"Excluded only 2022 count: {len(only_2022)} -> {sorted(only_2022)}")
print(f"Excluded only 2023 count: {len(only_2023)} -> {sorted(only_2023)}")
print(f"\nMatched 2022 sum: {matched_2022_sum:,}")
print(f"Matched 2023 sum: {matched_2023_sum:,}")
print(f"Excluded 2022 sum: {excl_2022_sum:,}")
print(f"Excluded 2023 sum: {excl_2023_sum:,}")
print(f"Annual 2022 sum: {annual_2022_sum:,}")
print(f"Annual 2023 sum: {annual_2023_sum:,}")
print(f"\nReconciliation 2022: {matched_2022_sum} + {excl_2022_sum} = {matched_2022_sum + excl_2022_sum} (annual={annual_2022_sum}) {'OK' if matched_2022_sum + excl_2022_sum == annual_2022_sum else 'FAIL'}")
print(f"Reconciliation 2023: {matched_2023_sum} + {excl_2023_sum} = {matched_2023_sum + excl_2023_sum} (annual={annual_2023_sum}) {'OK' if matched_2023_sum + excl_2023_sum == annual_2023_sum else 'FAIL'}")

# 2024 admin total
val_2024 = sum(val or 0 for yr, s, r, orig, gid, val in rows if yr == 2024 and classify(orig) == "administrative_district")
count_2024 = len(set(gid for yr, s, r, orig, gid, val in rows if yr == 2024 and classify(orig) == "administrative_district"))
print(f"\n2024 Admin total cases: {val_2024:,} across {count_2024} districts")

