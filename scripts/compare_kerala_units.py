"""
Compare Kerala units between 2021, 2022, and 2023.
"""
import glob, csv

def get_kerala_units(year):
    files = glob.glob(f"data/**/{year}/**/*districtwise*t12*", recursive=True)
    if not files: return []
    with open(files[0], encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader)
        return [(r[1], r[2]) for r in reader if len(r) > 2]

u21 = get_kerala_units(2021)
u22 = get_kerala_units(2022)
u23 = get_kerala_units(2023)

print("=== 2021 Kerala Units ===")
for sl, name in u21: print(f"  {sl}: {name}")

print("\n=== 2022 Kerala Units ===")
for sl, name in u22: print(f"  {sl}: {name}")

print("\n=== 2023 Kerala Units ===")
for sl, name in u23: print(f"  {sl}: {name}")

