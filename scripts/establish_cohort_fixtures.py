"""
Task 2: Independently establish the 2022-2023 matched cohort for the new release.
Derives membership, exclusions, endpoint sums, annual sums.
Keeps computation independent of dashboardQuery.ts logic.
"""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
TOTAL_CAT = "50920ae7b610c017c4ae1410"  # Total Cognizable IPC/BNS crimes
conn = sqlite3.connect(DB)
cur = conn.cursor()

# --- Annual eligible counts (all admin districts in each year) ---
def annual_total(year):
    cur.execute(f"""
        SELECT SUM(reported_value), COUNT(DISTINCT geography_id)
        FROM crime_observations
        WHERE year={year}
          AND region_type='administrative_district'
          AND comparison_status='eligible'
          AND mapped_category_id='{TOTAL_CAT}'
    """)
    return cur.fetchone()

print("=== Annual totals (administrative_district, eligible, official_total) ===")
ann = {}
for yr in [2021, 2022, 2023, 2024]:
    total, units = annual_total(yr)
    ann[yr] = {"total": total, "units": units}
    print(f"  {yr}: total={total:>12,}  units={units}")

# --- Units present in BOTH 2022 and 2023 ---
cur.execute("""
    SELECT DISTINCT state_name||'|'||region_name AS key, geography_id
    FROM crime_observations
    WHERE year=2022 AND region_type='administrative_district'
      AND comparison_status='eligible'
""")
units_2022 = {r[0]: r[1] for r in cur.fetchall()}

cur.execute("""
    SELECT DISTINCT state_name||'|'||region_name AS key, geography_id
    FROM crime_observations
    WHERE year=2023 AND region_type='administrative_district'
      AND comparison_status='eligible'
""")
units_2023 = {r[0]: r[1] for r in cur.fetchall()}

matched_keys = set(units_2022.keys()) & set(units_2023.keys())
only_2022 = set(units_2022.keys()) - matched_keys
only_2023 = set(units_2023.keys()) - matched_keys

print(f"\n=== 2022-2023 name-matched cohort ===")
print(f"  Units in 2022: {len(units_2022)}")
print(f"  Units in 2023: {len(units_2023)}")
print(f"  Matched (in both): {len(matched_keys)}")
print(f"  Only in 2022 (excluded from matched): {len(only_2022)}")
print(f"  Only in 2023 (excluded from matched): {len(only_2023)}")

# --- Matched cohort sums (official_total only, eligible) ---
gids_2022 = tuple(units_2022[k] for k in matched_keys)
gids_2023 = tuple(units_2023[k] for k in matched_keys)

cur.execute(f"""
    SELECT SUM(reported_value), COUNT(DISTINCT geography_id)
    FROM crime_observations
    WHERE year=2022
      AND geography_id IN ({','.join('?'*len(gids_2022))})
      AND mapped_category_id='{TOTAL_CAT}'
      AND comparison_status='eligible'
""", gids_2022)
matched_2022_total, matched_2022_units = cur.fetchone()

cur.execute(f"""
    SELECT SUM(reported_value), COUNT(DISTINCT geography_id)
    FROM crime_observations
    WHERE year=2023
      AND geography_id IN ({','.join('?'*len(gids_2023))})
      AND mapped_category_id='{TOTAL_CAT}'
      AND comparison_status='eligible'
""", gids_2023)
matched_2023_total, matched_2023_units = cur.fetchone()

print(f"\n=== Matched-cohort sums (official_total, eligible) ===")
print(f"  2022 matched: total={matched_2022_total:>12,}  units={matched_2022_units}")
print(f"  2023 matched: total={matched_2023_total:>12,}  units={matched_2023_units}")

# --- Excluded units sums ---
excl_gids_2022 = tuple(units_2022[k] for k in only_2022)
excl_gids_2023 = tuple(units_2023[k] for k in only_2023)

excl_2022_total = 0
if excl_gids_2022:
    cur.execute(f"""
        SELECT SUM(reported_value)
        FROM crime_observations
        WHERE year=2022
          AND geography_id IN ({','.join('?'*len(excl_gids_2022))})
          AND mapped_category_id='{TOTAL_CAT}'
          AND comparison_status='eligible'
    """, excl_gids_2022)
    excl_2022_total = cur.fetchone()[0] or 0

excl_2023_total = 0
if excl_gids_2023:
    cur.execute(f"""
        SELECT SUM(reported_value)
        FROM crime_observations
        WHERE year=2023
          AND geography_id IN ({','.join('?'*len(excl_gids_2023))})
          AND mapped_category_id='{TOTAL_CAT}'
          AND comparison_status='eligible'
    """, excl_gids_2023)
    excl_2023_total = cur.fetchone()[0] or 0

print(f"\n=== Excluded-unit sums ===")
print(f"  2022 excluded total: {excl_2022_total:>12,}")
print(f"  2023 excluded total: {excl_2023_total:>12,}")

# --- Reconciliation: matched + excluded = annual ---
ann_2022 = ann[2022]["total"]
ann_2023 = ann[2023]["total"]

recon_2022 = matched_2022_total + excl_2022_total
recon_2023 = matched_2023_total + excl_2023_total

print(f"\n=== Reconciliation: matched + excluded == annual ===")
print(f"  2022: {matched_2022_total:,} + {excl_2022_total:,} = {recon_2022:,}  (annual={ann_2022:,})  {'OK' if recon_2022 == ann_2022 else 'MISMATCH'}")
print(f"  2023: {matched_2023_total:,} + {excl_2023_total:,} = {recon_2023:,}  (annual={ann_2023:,})  {'OK' if recon_2023 == ann_2023 else 'MISMATCH'}")

# --- Category and unit-type scope ---
print(f"\n=== Scope ===")
print(f"  Category: mapped_category_id={TOTAL_CAT} (Total Cognizable IPC/BNS crimes)")
print(f"  Unit type: administrative_district")
print(f"  Eligibility: comparison_status='eligible'")
print(f"  Matching: state_name||'|'||region_name (name-based, not boundary-verified)")

# --- Exact fixture values for regression test ---
print(f"\n=== FIXTURE VALUES FOR REGRESSION TEST ===")
print(f"  matched_units_count_2022_2023 = {len(matched_keys)}")
print(f"  excluded_only_in_2022 = {len(only_2022)}")
print(f"  excluded_only_in_2023 = {len(only_2023)}")
print(f"  matched_2022_total = {matched_2022_total}")
print(f"  matched_2023_total = {matched_2023_total}")
print(f"  annual_2022_total = {ann_2022}")
print(f"  annual_2023_total = {ann_2023}")
print(f"  excluded_2022_total = {excl_2022_total}")
print(f"  excluded_2023_total = {excl_2023_total}")

conn.close()

# Sample of excluded units in 2022 for transparency
print(f"\nSample excluded-only-2022 units: {sorted(only_2022)[:5]}")
print(f"Sample excluded-only-2023 units: {sorted(only_2023)[:5]}")

