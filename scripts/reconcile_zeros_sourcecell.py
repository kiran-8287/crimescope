"""
Task 1 continued: Source-cell-level value comparison.
Stable key: (source_id, source_row_reference, category_id, year)
Report unchanged, changed, added, removed, and null<->zero transitions.
"""
import sqlite3

OLD_DB = "data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite"
NEW_DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
SCOPE = "comparison_status='eligible' AND region_type!='aggregate'"

old = sqlite3.connect(OLD_DB)
new = sqlite3.connect(NEW_DB)

print("Loading old cells...")
old_cells = {}
for r in old.execute(f"""
    SELECT source_id, source_row_reference, category_id, year, reported_value
    FROM crime_observations
    WHERE {SCOPE}
"""):
    key = (r[0], r[1], r[2], r[3])
    old_cells[key] = r[4]

print(f"Old cells loaded: {len(old_cells):,}")

print("Loading new cells...")
new_cells = {}
for r in new.execute(f"""
    SELECT source_id, source_row_reference, category_id, year, reported_value
    FROM crime_observations
    WHERE {SCOPE}
"""):
    key = (r[0], r[1], r[2], r[3])
    new_cells[key] = r[4]

print(f"New cells loaded: {len(new_cells):,}")

old_keys = set(old_cells.keys())
new_keys = set(new_cells.keys())

added = new_keys - old_keys
removed = old_keys - new_keys
common = old_keys & new_keys

print(f"\n=== Source-cell comparison ===")
print(f"Common keys: {len(common):,}")
print(f"Added (in NEW only): {len(added):,}")
print(f"Removed (in OLD only): {len(removed):,}")

# Among common keys: value changes
unchanged = sum(1 for k in common if old_cells[k] == new_cells[k])
changed = [(k, old_cells[k], new_cells[k]) for k in common if old_cells[k] != new_cells[k]]
print(f"Unchanged values: {unchanged:,}")
print(f"Changed values: {len(changed):,}")

# Null-to-zero / zero-to-null transitions
null_to_zero = [(k, ov, nv) for k, ov, nv in changed if ov is None and nv == 0]
zero_to_null = [(k, ov, nv) for k, ov, nv in changed if ov == 0 and nv is None]
other_changes = [(k, ov, nv) for k, ov, nv in changed if not (ov is None and nv == 0) and not (ov == 0 and nv is None)]
print(f"  Null→Zero: {len(null_to_zero):,}")
print(f"  Zero→Null: {len(zero_to_null):,}")
print(f"  Other value changes: {len(other_changes):,}")

# Zeros in added rows
added_zeros = sum(1 for k in added if new_cells[k] == 0)
removed_zeros = sum(1 for k in removed if old_cells[k] == 0)
print(f"\nZeros in ADDED rows: {added_zeros:,}")
print(f"Zeros in REMOVED rows: {removed_zeros:,}")

# Account for the zero difference
old_total_zeros = sum(1 for v in old_cells.values() if v == 0)
new_total_zeros = sum(1 for v in new_cells.values() if v == 0)
print(f"\nOld total zeros (scope): {old_total_zeros:,}")
print(f"New total zeros (scope): {new_total_zeros:,}")
print(f"Zero diff: {new_total_zeros - old_total_zeros:+,}")
print(f"Explanation: added_zeros({added_zeros}) - removed_zeros({removed_zeros}) + null_to_zero({len(null_to_zero)}) - zero_to_null({len(zero_to_null)}) + other({sum(1 for _,ov,nv in other_changes if nv==0) - sum(1 for _,ov,nv in other_changes if ov==0)}) = {added_zeros - removed_zeros + len(null_to_zero) - len(zero_to_null)}")

# Sample added rows with region_type to understand WHY they were added
if added:
    sample_added = list(added)[:3]
    print(f"\nSample ADDED source cells (new_value shown):")
    for k in sample_added:
        print(f"  source={k[0]}, row_ref={k[1]}, cat={k[2]}, year={k[3]}, value={new_cells[k]}")

if removed:
    sample_removed = list(removed)[:3]
    print(f"\nSample REMOVED source cells (old value shown):")
    for k in sample_removed:
        print(f"  source={k[0]}, row_ref={k[1]}, cat={k[2]}, year={k[3]}, value={old_cells[k]}")

old.close()
new.close()
print("\nDone.")

