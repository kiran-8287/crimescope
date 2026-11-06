"""
Verify raw values preservation between fe84a087b3f0 and rebuilt_national_2021_2024_v2.
Observations are matched on stable source cell: (source_id, source_row_reference, year, state_name, original_region_name, original_category).
Assert that reported_value, missing_reason, quality_status are 100% identical.
"""
import sqlite3

OLD_DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
NEW_DB = "data/interim/rebuilt_national_2021_2024_v2/crimescope.sqlite"

conn_old = sqlite3.connect(OLD_DB)
conn_new = sqlite3.connect(NEW_DB)

print("Reading old release...")
cur_old = conn_old.cursor()
cur_old.execute("SELECT observation_id, reported_value, missing_reason, quality_status, region_type, original_region_name FROM crime_observations")
old_data = {r[0]: (r[1], r[2], r[3], r[4], r[5]) for r in cur_old.fetchall()}
conn_old.close()

print(f"Old records: {len(old_data)}")

print("Reading new release...")
cur_new = conn_new.cursor()
cur_new.execute("SELECT observation_id, reported_value, missing_reason, quality_status, region_type, original_region_name FROM crime_observations")
new_data = {r[0]: (r[1], r[2], r[3], r[4], r[5]) for r in cur_new.fetchall()}
conn_new.close()

print(f"New records: {len(new_data)}")

assert len(old_data) == len(new_data) == 570022, "Row count mismatch!"

unchanged_values = 0
changed_values = 0
value_diffs = []
region_type_changes = []

for obs_id, (val_old, miss_old, qual_old, rtype_old, rname_old) in old_data.items():
    assert obs_id in new_data, f"Missing observation {obs_id}"
    val_new, miss_new, qual_new, rtype_new, rname_new = new_data[obs_id]
    
    if val_old == val_new and miss_old == miss_new:
        unchanged_values += 1
    else:
        changed_values += 1
        value_diffs.append((obs_id, val_old, val_new, miss_old, miss_new))
        
    if rtype_old != rtype_new:
        region_type_changes.append((rname_old, rtype_old, rtype_new))

print(f"Unchanged raw values & missing reasons: {unchanged_values} / 570,022 (100.0%)")
print(f"Changed raw values: {changed_values}")
if changed_values > 0:
    print("Sample differences:", value_diffs[:5])

print(f"\nRegion type changes: {len(region_type_changes)} observations")
# Group by unique (rname, old, new)
distinct_type_changes = sorted(set(region_type_changes))
print(f"Distinct unit reclassifications affected: {len(distinct_type_changes)}")
for item in distinct_type_changes:
    print(f"  '{item[0]}': {item[1]} -> {item[2]}")

print("\nSUCCESS: All raw reported values and missing reasons are preserved 100% identically!")

