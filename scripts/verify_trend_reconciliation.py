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

# 1. Total eligible annual sum in 2022
cur.execute("SELECT SUM(reported_value) FROM crime_observations WHERE year = 2022 AND original_category = 'Total Cognizable IPC crimes' AND comparison_status = 'eligible' AND region_type != 'aggregate'")
total_2022 = cur.fetchone()[0]

# 2. Total eligible annual sum in 2023
cur.execute("SELECT SUM(reported_value) FROM crime_observations WHERE year = 2023 AND original_category = 'Total Cognizable IPC crimes' AND comparison_status = 'eligible' AND region_type != 'aggregate'")
total_2023 = cur.fetchone()[0]

# 3. Matched sum in 2022 and 2023
cur.execute("SELECT SUM(reported_value) FROM crime_observations WHERE year = 2022 AND original_category = 'Total Cognizable IPC crimes' AND (state_name || '|' || region_type || '|' || region_name) IN ({seq})".format(seq=','.join(['?']*len(common))), list(common))
matched_2022 = cur.fetchone()[0]

cur.execute("SELECT SUM(reported_value) FROM crime_observations WHERE year = 2023 AND original_category = 'Total Cognizable IPC crimes' AND (state_name || '|' || region_type || '|' || region_name) IN ({seq})".format(seq=','.join(['?']*len(common))), list(common))
matched_2023 = cur.fetchone()[0]

# 4. Excluded sum in 2022 and 2023
cur.execute("SELECT SUM(reported_value) FROM crime_observations WHERE year = 2022 AND original_category = 'Total Cognizable IPC crimes' AND (state_name || '|' || region_type || '|' || region_name) IN ({seq})".format(seq=','.join(['?']*len(excl_22))), list(excl_22))
excl_sum_2022 = cur.fetchone()[0]

cur.execute("SELECT SUM(reported_value) FROM crime_observations WHERE year = 2023 AND original_category = 'Total Cognizable IPC crimes' AND (state_name || '|' || region_type || '|' || region_name) IN ({seq})".format(seq=','.join(['?']*len(excl_23))), list(excl_23))
excl_sum_2023 = cur.fetchone()[0]

print("=== 2022 RECONCILIATION ===")
print(f"Matched 2022 Sum:  {matched_2022:,}")
print(f"Excluded 2022 Sum: {excl_sum_2022:,}")
print(f"Sum (Matched+Excl):{matched_2022 + excl_sum_2022:,}")
print(f"Total Annual 2022: {total_2022:,}")
print(f"Exact Match: {matched_2022 + excl_sum_2022 == total_2022}")

print("\n=== 2023 RECONCILIATION ===")
print(f"Matched 2023 Sum:  {matched_2023:,}")
print(f"Excluded 2023 Sum: {excl_sum_2023:,}")
print(f"Sum (Matched+Excl):{matched_2023 + excl_sum_2023:,}")
print(f"Total Annual 2023: {total_2023:,}")
print(f"Exact Match: {matched_2023 + excl_sum_2023 == total_2023}")
conn.close()

