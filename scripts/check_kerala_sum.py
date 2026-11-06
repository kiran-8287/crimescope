"""
Check if 'All Districts' is summed into 'Total Districts' in Kerala Table 12 (2022).
"""
import glob, csv

f12 = glob.glob("data/**/2022/**/*districtwise*t12*", recursive=True)[0]
with open(f12, encoding="utf-8", errors="replace") as f:
    rows = list(csv.reader(f))

last_col_idx = len(rows[0]) - 1

# Sum of rows 1..22 vs row 23
sum_including_all_districts = sum(int(rows[i][-1] or 0) for i in range(1, 23))
sum_excluding_all_districts = sum(int(rows[i][-1] or 0) for i in range(2, 23))
total_districts_val = int(rows[23][-1] or 0)

print(f"Total Districts value in source: {total_districts_val}")
print(f"Sum of rows 1..22 (INCLUDING 'All Districts'): {sum_including_all_districts} (diff = {sum_including_all_districts - total_districts_val})")
print(f"Sum of rows 2..22 (EXCLUDING 'All Districts'): {sum_excluding_all_districts} (diff = {sum_excluding_all_districts - total_districts_val})")

# Check col 3 (first crime column)
col3_tot = int(rows[23][3])
col3_inc = sum(int(rows[i][3]) for i in range(1, 23))
col3_exc = sum(int(rows[i][3]) for i in range(2, 23))
print(f"\nCol 3 Total Districts: {col3_tot}")
print(f"Col 3 INCLUDING 'All Districts': {col3_inc} (diff = {col3_inc - col3_tot})")
print(f"Col 3 EXCLUDING 'All Districts': {col3_exc} (diff = {col3_exc - col3_tot})")

