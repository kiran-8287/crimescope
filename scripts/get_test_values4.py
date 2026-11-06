"""Get matched units count for 2022-2023 comparison."""
import sqlite3

DB = "data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite"
conn = sqlite3.connect(DB)
cur = conn.cursor()

# Match by state_name | region_type | region_name
cur.execute("""
    SELECT CONCAT(state_name,'|',region_type,'|',region_name) as key
    FROM crime_observations
    WHERE year=2022 AND region_type='administrative_district'
    GROUP BY key
""")
keys_2022 = set(r[0] for r in cur.fetchall())

cur.execute("""
    SELECT CONCAT(state_name,'|',region_type,'|',region_name) as key
    FROM crime_observations
    WHERE year=2023 AND region_type='administrative_district'
    GROUP BY key
""")
keys_2023 = set(r[0] for r in cur.fetchall())

matched = keys_2022 & keys_2023
print(f"Units in 2022: {len(keys_2022)}")
print(f"Units in 2023: {len(keys_2023)}")
print(f"Matched 2022-2023: {len(matched)}")

# Also get the quality summary stats
cur.execute("SELECT COUNT(*) FROM crime_observations")
total = cur.fetchone()[0]
print(f"\nTotal observations: {total:,}")

cur.execute("SELECT COUNT(*) FROM crime_observations WHERE reported_value = 0")
zeros = cur.fetchone()[0]
print(f"Explicit zeros: {zeros:,}")

cur.execute("SELECT COUNT(*) FROM crime_observations WHERE reported_value IS NULL OR missing_reason IS NOT NULL")
missing = cur.fetchone()[0]
print(f"Missing: {missing}")

conn.close()

