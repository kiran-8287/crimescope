// Check two exact source-backed observations through the live bounded dashboard API.
import { readFileSync } from "node:fs";

const pointer = JSON.parse(readFileSync("data/serving/current.json", "utf8"));
const taxonomy = JSON.parse(readFileSync("config/category_hierarchy.json", "utf8"));

function categoryId(predicate, description) {
  const match = taxonomy.categories.find(category => category.years.includes(2024) && predicate(category.label));
  if (!match) throw new Error(`No 2024 category found for ${description}`);
  return match.id;
}

async function verify({ key, state, region, labelMatch, expectedCases }) {
  const id = categoryId(labelMatch, key);
  const url = new URL("http://localhost:4000/api/v1/dashboard");
  url.searchParams.set("year", "2024");
  url.searchParams.set("category", id);
  url.searchParams.set("view", "overview");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${key}: dashboard API returned ${response.status}`);
  const payload = await response.json();
  if (payload.meta?.servingDatabase?.releaseId !== pointer.release_id) {
    throw new Error(`${key}: API release ${payload.meta?.servingDatabase?.releaseId} differs from current pointer ${pointer.release_id}`);
  }
  const record = payload.observations.find(row => row.state === state && row.region === region && row.year === 2024 && row.regionType === "administrative_district" && row.category === id);
  if (!record) throw new Error(`${key}: expected source row was absent`);
  if (record.cases !== expectedCases) throw new Error(`${key}: expected ${expectedCases} cases, received ${record.cases}`);
  if (!labelMatch(record.categoryLabel)) throw new Error(`${key}: unexpected source label ${record.categoryLabel}`);
  return { state, region, year: record.year, categoryId: id, categoryLabel: record.categoryLabel, cases: record.cases };
}

const records = await Promise.all([
  verify({ key: "Anjaw rape", state: "Arunachal Pradesh", region: "Anjaw", labelMatch: label => label === "Rape", expectedCases: 0 }),
  verify({ key: "Anantapuramu murder", state: "Andhra Pradesh", region: "Anantapuramu", labelMatch: label => /^Murder BNS.*302 IPC/i.test(label), expectedCases: 62 }),
]);

console.log(JSON.stringify({ releaseId: pointer.release_id, records }, null, 2));
