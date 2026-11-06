import sqlite3

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()

# Get eligible units in 2022 and 2023
cur.execute("SELECT DISTINCT geography_id, state_name, region_name, region_type FROM crime_observations WHERE year = 2022 AND comparison_status = 'eligible'")
units_2022 = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

cur.execute("SELECT DISTINCT geography_id, state_name, region_name, region_type FROM crime_observations WHERE year = 2023 AND comparison_status = 'eligible'")
units_2023 = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

set_2022 = set(units_2022.keys())
set_2023 = set(units_2023.keys())

matched = set_2022 & set_2023
excl_2022 = set_2022 - set_2023
excl_2023 = set_2023 - set_2022

print(f"2022 eligible units: {len(set_2022)}")
print(f"2023 eligible units: {len(set_2023)}")
print(f"Matched units (same geography_id): {len(matched)}")
print(f"Excluded from 2022 only: {len(excl_2022)}")
print(f"Excluded from 2023 only: {len(excl_2023)}")

print("\nSample excluded from 2022:")
for gid in sorted(excl_2022)[:10]:
    print(f"  {units_2022[gid]}")

print("\nSample excluded from 2023:")
for gid in sorted(excl_2023)[:10]:
    print(f"  {units_2023[gid]}")

conn.close()

