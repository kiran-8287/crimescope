import sqlite3

conn = sqlite3.connect("data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite")
cur = conn.cursor()

# Query regions using state|region_type|region_name as in dashboardQuery.ts
cur.execute("SELECT DISTINCT state_name, region_type, region_name FROM crime_observations WHERE year = 2022 AND comparison_status = 'eligible' AND region_type != 'aggregate'")
set_2022 = {f"{r[0]}|{r[1]}|{r[2]}": r for r in cur.fetchall()}

cur.execute("SELECT DISTINCT state_name, region_type, region_name FROM crime_observations WHERE year = 2023 AND comparison_status = 'eligible' AND region_type != 'aggregate'")
set_2023 = {f"{r[0]}|{r[1]}|{r[2]}": r for r in cur.fetchall()}

common = set(set_2022.keys()) & set(set_2023.keys())
excl_22 = set(set_2022.keys()) - common
excl_23 = set(set_2023.keys()) - common

print(f"2022 eligible: {len(set_2022)}")
print(f"2023 eligible: {len(set_2023)}")
print(f"Common (matched): {len(common)}")
print(f"Excluded from 2022: {len(excl_22)}")
print(f"Excluded from 2023: {len(excl_23)}")

print("\n--- Excluded from 2022 (first 10) ---")
for k in sorted(excl_22)[:10]:
    print(" ", set_2022[k])

print("\n--- Excluded from 2023 (first 10) ---")
for k in sorted(excl_23)[:10]:
    print(" ", set_2023[k])

# Check total cases for the matched 892 units in 2022 and 2023
cur.execute("""
    SELECT year, SUM(reported_value)
    FROM crime_observations
    WHERE original_category = 'Total Cognizable IPC crimes'
      AND (state_name || '|' || region_type || '|' || region_name) IN ({seq})
    GROUP BY year
""".format(seq=','.join(['?']*len(common))), list(common))
print("\nTotals across the matched common cohort for 'Total Cognizable IPC crimes':")
for r in cur.fetchall():
    print(f"  Year {r[0]}: {r[1]:,} cases")

conn.close()

