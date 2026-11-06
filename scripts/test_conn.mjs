import { getDatabaseAsync } from '../backend/dist/db/connection.js';

async function test() {
  const db = await getDatabaseAsync();
  const res = db.exec("SELECT COUNT(DISTINCT geography_id) FROM crime_observations WHERE year=2024 AND region_type='administrative_district'");
  console.log("Count from connection.js:", res[0].values[0][0]);
}

test().catch(console.error);
