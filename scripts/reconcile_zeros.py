"""
Task 1: Reconcile explicit-zero difference between old and new releases.
Compare under identical eligibility + aggregate filters.
Use stable source-cell identity: (source_id, source_row_reference, category_id, year).
"""
import sqlite3

OLD_DB = "data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite"
NEW_DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"

SCOPE = "comparison_status='eligible' AND region_type!='aggregate'"

def q(conn, sql):
    return conn.execute(sql).fetchall()

old = sqlite3.connect(OLD_DB)
new = sqlite3.connect(NEW_DB)

print("=" * 60)
print("SCOPE: comparison_status='eligible' AND region_type!='aggregate'")
print("=" * 60)

# 1. Total row counts under scope
old_total = q(old, f"SELECT COUNT(*) FROM crime_observations WHERE {SCOPE}")[0][0]
new_total = q(new, f"SELECT COUNT(*) FROM crime_observations WHERE {SCOPE}")[0][0]
print(f"\nTotal eligible non-aggregate rows:")
print(f"  OLD: {old_total:,}")
print(f"  NEW: {new_total:,}")
print(f"  Diff: {new_total - old_total:+,}")

# 2. Explicit zeros under scope
old_zeros = q(old, f"SELECT COUNT(*) FROM crime_observations WHERE {SCOPE} AND reported_value=0")[0][0]
new_zeros = q(new, f"SELECT COUNT(*) FROM crime_observations WHERE {SCOPE} AND reported_value=0")[0][0]
print(f"\nExplicit zeros (reported_value=0) under scope:")
print(f"  OLD: {old_zeros:,}")
print(f"  NEW: {new_zeros:,}")
print(f"  Diff: {new_zeros - old_zeros:+,}")

# 3. Region type breakdown of zero rows
print(f"\nZero rows by region_type (OLD):")
for r in q(old, f"SELECT region_type, COUNT(*) FROM crime_observations WHERE comparison_status='eligible' AND reported_value=0 GROUP BY region_type ORDER BY COUNT(*) DESC"):
    print(f"  {r[0]}: {r[1]:,}")

print(f"\nZero rows by region_type (NEW):")
for r in q(new, f"SELECT region_type, COUNT(*) FROM crime_observations WHERE comparison_status='eligible' AND reported_value=0 GROUP BY region_type ORDER BY COUNT(*) DESC"):
    print(f"  {r[0]}: {r[1]:,}")

# 4. Zeros by year
print(f"\nZero rows by year — OLD vs NEW (scope=eligible, non-aggregate):")
old_by_year = {r[0]: r[1] for r in q(old, f"SELECT year, COUNT(*) FROM crime_observations WHERE {SCOPE} AND reported_value=0 GROUP BY year")}
new_by_year = {r[0]: r[1] for r in q(new, f"SELECT year, COUNT(*) FROM crime_observations WHERE {SCOPE} AND reported_value=0 GROUP BY year")}
for yr in sorted(set(list(old_by_year.keys()) + list(new_by_year.keys()))):
    ov = old_by_year.get(yr, 0); nv = new_by_year.get(yr, 0)
    print(f"  {yr}: OLD={ov:,}  NEW={nv:,}  DIFF={nv-ov:+,}")

# 5. Zeros by region_type AND year — focus on changed types
print(f"\nZero rows by region_type + year:")
print(f"{'Type':<30} {'Year':>4}  {'OLD':>8}  {'NEW':>8}  {'DIFF':>8}")
old_rt = {(r[0],r[1]): r[2] for r in q(old, f"SELECT region_type, year, COUNT(*) FROM crime_observations WHERE {SCOPE} AND reported_value=0 GROUP BY region_type, year")}
new_rt = {(r[0],r[1]): r[2] for r in q(new, f"SELECT region_type, year, COUNT(*) FROM crime_observations WHERE {SCOPE} AND reported_value=0 GROUP BY region_type, year")}
all_keys = sorted(set(list(old_rt.keys()) + list(new_rt.keys())))
for k in all_keys:
    ov = old_rt.get(k, 0); nv = new_rt.get(k, 0)
    if ov != nv:
        print(f"  {k[0]:<28} {k[1]:>4}  {ov:>8,}  {nv:>8,}  {nv-ov:>+8,}  <-- CHANGED")
    else:
        print(f"  {k[0]:<28} {k[1]:>4}  {ov:>8,}  {nv:>8,}  {nv-ov:>+8,}")

old.close()
new.close()
print("\nDone.")

