"""
Inspect rows 12-20 of Nagaland 2023 Table 18.
"""
import glob, csv

f_nagaland_2023 = glob.glob("data/**/2023/**/*districtwise*t18*", recursive=True)[0]
with open(f_nagaland_2023, encoding="utf-8", errors="replace") as f:
    for i, r in enumerate(csv.reader(f)):
        if 11 <= i <= 20:
            print(f"  Row {i}: sl='{r[1]}' name='{r[2]}' last={r[-1]}")

