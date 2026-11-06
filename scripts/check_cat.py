import sqlite3, json

conn = sqlite3.connect('data/serving/releases/ncrb-districtwise-2021-2024-fe84a087b3f0/crimescope.sqlite')
cur = conn.cursor()

cur.execute("SELECT DISTINCT category_id, mapped_category_id, original_category FROM crime_observations WHERE year=2024 AND original_category LIKE '%Total%' LIMIT 5")
for r in cur.fetchall():
    print(r)

taxonomy = json.load(open('config/category_hierarchy.json'))
for c in taxonomy['categories']:
    if 'total' in c['label'].lower():
        print("Taxonomy:", c['id'], c['label'])

