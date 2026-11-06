"""
Compute exact fixtures directly from the new active SQLite release.
"""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fd2d8578be56/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

# Official total category
cur.execute("""
    SELECT DISTINCT year, state_name, region_name, geography_id, reported_value
    FROM crime_observations
    WHERE mapped_category_id = '50920ae7b610c017c4ae1410'
      AND comparison_status = 'eligible' AND region_type = 'administrative_district'
""")
rows = cur.fetchall()

units_2022 = {}
units_2023 = {}
values_2022 = {}
values_2023 = {}

for yr, s, r, gid, val in rows:
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

print("=== NEW RELEASE FIXTURES (ncrb-districtwise-2021-2024-fd2d8578be56) ===")
print(f"2022 Admin units count: {len(units_2022)}")
print(f"2023 Admin units count: {len(units_2023)}")
print(f"Matched count: {len(common_keys)}")
print(f"Excluded only 2022 count: {len(only_2022)} -> {sorted(only_2022)}")
print(f"Excluded only 2023 count: {len(only_2023)} -> {sorted(only_2023)}")
print(f"Matched 2022 sum: {matched_2022_sum:,} ({matched_2022_sum})")
print(f"Matched 2023 sum: {matched_2023_sum:,} ({matched_2023_sum})")
print(f"Excluded 2022 sum: {excl_2022_sum:,} ({excl_2022_sum})")
print(f"Excluded 2023 sum: {excl_2023_sum:,} ({excl_2023_sum})")
print(f"Annual 2022 sum: {annual_2022_sum:,} ({annual_2022_sum})")
print(f"Annual 2023 sum: {annual_2023_sum:,} ({annual_2023_sum})")

cur.execute("""
    SELECT COUNT(DISTINCT geography_id), SUM(reported_value)
    FROM crime_observations
    WHERE year = 2024 AND comparison_status = 'eligible' AND region_type = 'administrative_district'
      AND mapped_category_id = '50920ae7b610c017c4ae1410'
""")
c24, v24 = cur.fetchone()
print(f"2024 Admin units: {c24}, total cases: {v24:,} ({v24})")

# Check explicit zeros in new release
cur.execute("""
    SELECT COUNT(*) FROM crime_observations
    WHERE comparison_status = 'eligible' AND region_type != 'aggregate' AND reported_value = 0
""")
z_eligible = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM crime_observations
    WHERE comparison_status = 'eligible' AND region_type != 'aggregate'
""")
tot_eligible = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM crime_observations
    WHERE reported_value = 0
""")
z_all = cur.fetchone()[0]

print(f"Eligible observations: {tot_eligible}, explicit zeros in eligible: {z_eligible}, all explicit zeros: {z_all}")
conn.close()

