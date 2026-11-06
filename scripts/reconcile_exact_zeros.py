import sqlite3

conn = sqlite3.connect('data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite')
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM crime_observations WHERE reported_value = 0')
all_zeros = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM crime_observations WHERE comparison_status='eligible' AND region_type!='aggregate' AND reported_value = 0")
eligible_zeros = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM crime_observations WHERE NOT (comparison_status='eligible' AND region_type!='aggregate') AND reported_value = 0")
non_eligible_zeros = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM crime_observations WHERE region_type='aggregate' AND reported_value = 0")
agg_zeros = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM crime_observations WHERE comparison_status!='eligible' AND region_type!='aggregate' AND reported_value = 0")
quar_non_agg_zeros = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM crime_observations WHERE comparison_status!='eligible' AND reported_value = 0")
all_quarantine_zeros = cur.fetchone()[0]

print(f"Total rows in DB: 570,022")
print(f"Total zeros in DB: {all_zeros}")
print(f"Eligible non-aggregate zeros (Quality view scope): {eligible_zeros}")
print(f"Non-eligible / aggregate zeros: {non_eligible_zeros}")
print(f"  - Aggregate rows with value=0: {agg_zeros}")
print(f"  - Quarantined non-aggregate rows with value=0: {quar_non_agg_zeros}")
print(f"Verification: {eligible_zeros} + {non_eligible_zeros} = {eligible_zeros + non_eligible_zeros} (diff={all_zeros - (eligible_zeros + non_eligible_zeros)})")
print(f"Difference (330,527 - 324,466): {all_zeros - eligible_zeros}")

