"""
Deep dive into:
1. All rows of Kerala Table 12 in 2022, and comparison with 2021/2023 Kerala Table 12.
2. All rows of Nagaland Table 18 in 2023 & 2024, and comparison with 2021/2022.
3. How canonical.py classifies them.
"""
import glob, csv

print("=== Kerala 2022 Table 12: ALL ROWS ===")
f_kerala_2022 = glob.glob("data/**/2022/**/*districtwise*t12*", recursive=True)[0]
with open(f_kerala_2022, encoding="utf-8", errors="replace") as f:
    for i, r in enumerate(csv.reader(f)):
        print(f"  Row {i}: {r}")

print("\n=== Kerala 2021 Table 12: ALL ROWS ===")
f_kerala_2021 = glob.glob("data/**/2021/**/*districtwise*t12*", recursive=True)
if f_kerala_2021:
    with open(f_kerala_2021[0], encoding="utf-8", errors="replace") as f:
        for i, r in enumerate(csv.reader(f)):
            print(f"  Row {i}: {r}")

print("\n=== Kerala 2023 Table 12: ALL ROWS ===")
f_kerala_2023 = glob.glob("data/**/2023/**/*districtwise*t12*", recursive=True)
if f_kerala_2023:
    with open(f_kerala_2023[0], encoding="utf-8", errors="replace") as f:
        for i, r in enumerate(csv.reader(f)):
            print(f"  Row {i}: {r}")

print("\n=== Nagaland 2023 Table 18: ALL ROWS ===")
f_nagaland_2023 = glob.glob("data/**/2023/**/*districtwise*t18*", recursive=True)[0]
with open(f_nagaland_2023, encoding="utf-8", errors="replace") as f:
    for i, r in enumerate(csv.reader(f)):
        print(f"  Row {i}: {r}")

print("\n=== Nagaland 2022 Table 18: ALL ROWS ===")
f_nagaland_2022 = glob.glob("data/**/2022/**/*districtwise*t18*", recursive=True)
if f_nagaland_2022:
    with open(f_nagaland_2022[0], encoding="utf-8", errors="replace") as f:
        for i, r in enumerate(csv.reader(f)):
            print(f"  Row {i}: {r}")

