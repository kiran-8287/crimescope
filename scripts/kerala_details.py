"""
Inspect Kerala across all 2022 tables:
Does 'All Districts' appear in all tables or only Table 12?
And what is the last row of Table 12?
"""
import glob, csv

print("=== Kerala 2022 Table 12: Rows 0-5 and End of table ===")
f12 = glob.glob("data/**/2022/**/*districtwise*t12*", recursive=True)[0]
with open(f12, encoding="utf-8", errors="replace") as f:
    rows = list(csv.reader(f))
    print(f"Total rows in t12: {len(rows)}")
    for i in range(min(5, len(rows))):
        print(f"  Row {i}: sl='{rows[i][1]}' name='{rows[i][2]}' col3={rows[i][3]} col4={rows[i][4]} last={rows[i][-1]}")
    for i in range(max(0, len(rows)-5), len(rows)):
        print(f"  Row {i}: sl='{rows[i][1]}' name='{rows[i][2]}' col3={rows[i][3]} col4={rows[i][4]} last={rows[i][-1]}")

print("\n=== Check other 2022 Kerala tables for 'All Districts' ===")
for t in range(1, 15):
    files = glob.glob(f"data/**/2022/**/*districtwise*t{t}.csv", recursive=True)
    if files:
        with open(files[0], encoding="utf-8", errors="replace") as f:
            for i, r in enumerate(csv.reader(f)):
                if len(r) > 2 and "all districts" in r[2].lower():
                    print(f"  Found in t{t} at row {i}: sl='{r[1]}' name='{r[2]}'")

