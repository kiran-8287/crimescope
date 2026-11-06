"""
Inspect the raw source context for:
1. Gujarat table 7: rows around 40-45 in 2021, 2022, 2023, 2024
2. Kerala table 12 in 2022
3. Nagaland table 18 in 2023 and 2024
"""
import glob, os, csv

def find_file(pattern):
    matches = glob.glob(f"data/**/{pattern}", recursive=True)
    return matches[0] if matches else None

print("=== 1. Gujarat Table 7 ===")
# Look for raw source file for Gujarat
for yr in [2021, 2022, 2023, 2024]:
    # Search for source file
    files = glob.glob(f"data/**/{yr}/**/*districtwise*t7*", recursive=True)
    if files:
        fpath = files[0]
        print(f"\n{yr} source: {fpath}")
        with open(fpath, encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                if any("rly" in str(c).lower() or "railway" in str(c).lower() or "ahmedabad" in str(c).lower() for c in row):
                    print(f"  Line {i}: {row[:4]}")

print("\n=== 2. Kerala Table 12 (2022) ===")
files = glob.glob("data/**/2022/**/*districtwise*t12*", recursive=True)
if files:
    fpath = files[0]
    print(f"2022 Kerala t12: {fpath}")
    with open(fpath, encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i < 15:
                print(f"  Line {i}: {row[:5]}")

print("\n=== 3. Nagaland Table 18 (2023 & 2024) ===")
for yr in [2023, 2024]:
    files = glob.glob(f"data/**/{yr}/**/*districtwise*t18*", recursive=True)
    if files:
        fpath = files[0]
        print(f"\n{yr} Nagaland t18: {fpath}")
        with open(fpath, encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                if any("crime" in str(c).lower() or "nagaland" in str(c).lower() for c in row):
                    print(f"  Line {i}: {row[:5]}")

