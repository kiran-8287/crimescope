import { describe, it, expect } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Resolve the repository root the same way the services do (backend cwd → repo root),
// so the integrity checks below hash the real frozen artifacts, never a copy.
const repoRoot = existsSync(resolve(process.cwd(), "config/data_snapshot_manifest.json"))
  ? process.cwd()
  : resolve(process.cwd(), "..");
const readJson = (path: string) => JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
const sha256 = (path: string) => createHash("sha256").update(readFileSync(resolve(repoRoot, path))).digest("hex");

// Regression checks for the four dashboard corrections. These assert the server
// contract and saved-artifact values the corrected components depend on, so a
// future change that re-slices server pages, drifts PCA captions, or changes
// cluster shape fails loudly here rather than only in the browser.
describe("Dashboard corrections", () => {
  it("serves disjoint, metadata-consistent server pages for association rules", async () => {
    const { app } = await import("../app.js");
    const pageSize = 20;
    const page1 = await request(app)
      .get(`/api/v1/analysis/association-rules?year=2024&limit=${pageSize}&offset=0`)
      .expect(200);
    const page2 = await request(app)
      .get(`/api/v1/analysis/association-rules?year=2024&limit=${pageSize}&offset=${pageSize}`)
      .expect(200);

    const total = page1.body.total;
    expect(total).toBeGreaterThan(0);
    expect(page1.body.rules).toHaveLength(pageSize);
    // Page count is derived from response metadata, never hardcoded in the UI.
    const pages = Math.ceil(total / pageSize);
    expect(pages).toBe(35);

    // Metadata and displayed rows agree: the last page holds the remainder.
    const lastPage = await request(app)
      .get(`/api/v1/analysis/association-rules?year=2024&limit=${pageSize}&offset=${(pages - 1) * pageSize}`)
      .expect(200);
    expect(lastPage.body.total).toBe(total);
    expect(lastPage.body.rules).toHaveLength(total - (pages - 1) * pageSize);

    // Server pages are not re-sliced: consecutive pages are disjoint.
    const ids1 = new Set(page1.body.rules.map((r: any) => r.id));
    expect(page2.body.rules.every((r: any) => !ids1.has(r.id))).toBe(true);

    // An offset beyond the end yields an empty page but keeps the same total.
    const past = await request(app)
      .get(`/api/v1/analysis/association-rules?year=2024&limit=${pageSize}&offset=${total}`)
      .expect(200);
    expect(past.body.rules).toHaveLength(0);
    expect(past.body.total).toBe(total);
  }, 30000);

  it("derives PCA headline and cumulative captions from the current artifact", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/api/v1/dashboard").expect(200);
    const pca = res.body.methods.pca.result;
    expect(pca.n_regions).toBe(774);
    expect(pca.n_categories).toBe(131);

    const evr = pca.explained_variance_ratio;
    const cumulative = pca.cumulative_variance_ratio;
    expect(evr[0]).toBeCloseTo(0.1591084, 6);
    // The cumulative caption value equals the sum of the two headline values.
    expect(cumulative[1]).toBeCloseTo(evr[0] + evr[1], 10);
    // The value the UI renders (one decimal place) must not read the stale 22.7%.
    expect((cumulative[1] * 100).toFixed(1)).toBe("20.5");
  }, 30000);

  it("exposes traceable cluster sizes, centroids, and monotone inertia", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/api/v1/dashboard").expect(200);
    const results = res.body.methods.kmeans.results;
    const k3 = results["3"];
    expect(k3).toBeDefined();

    const sizes = k3.clusters.map((c: any) => c.size);
    // Cluster sizes sum to the cohort and match the recorded size vector.
    expect(sizes.reduce((a: number, b: number) => a + b, 0)).toBe(k3.n_regions);
    expect(k3.cluster_sizes).toEqual(sizes);
    // Each centroid is keyed by feature label with one entry per feature.
    for (const cluster of k3.clusters) {
      expect(Object.keys(cluster.centroid).length).toBe(k3.n_categories);
    }

    // Inertia falls as k rises (documented behaviour, not a goodness-of-fit score).
    const inertia = [3, 4, 5].map(k => results[String(k)].inertia);
    expect(inertia[0]).toBeGreaterThan(inertia[1]);
    expect(inertia[1]).toBeGreaterThan(inertia[2]);
    // The seed is reproducibility metadata only.
    expect(k3.seed).toBe(42);
  }, 30000);

  it("returns response-identical rule ids at offsets 0/20/680 with a complete, deterministically-sorted export", async () => {
    const { app } = await import("../app.js");
    const fetchPage = async (offset: number, limit: number) => {
      const res = await request(app)
        .get(`/api/v1/analysis/association-rules?year=2024&limit=${limit}&offset=${offset}`)
        .expect(200);
      return res.body;
    };
    const idsOf = (body: any) => body.rules.map((rule: any) => rule.id);

    const page1 = await fetchPage(0, 20);
    const page2 = await fetchPage(20, 20);
    const last = await fetchPage(680, 20);

    expect(page1.total).toBe(697);
    expect(page1.rules).toHaveLength(20);
    expect(page2.rules).toHaveLength(20);
    expect(last.rules).toHaveLength(17);
    // The final footer is 681–697: the last offset plus the remaining rows equals total.
    expect(680 + last.rules.length).toBe(page1.total);

    // The UI renders exactly the ids the endpoint returned, in the same order.
    expect(new Set(idsOf(page1)).size).toBe(20);
    // Consecutive pages are disjoint: no unintended overlap across the three windows.
    expect(new Set([...idsOf(page1), ...idsOf(page2), ...idsOf(last)]).size).toBe(20 + 20 + 17);

    // Deterministic: an identical request returns identical ids in identical order.
    expect(idsOf(await fetchPage(0, 20))).toEqual(idsOf(page1));

    // "Export all matching rules": paging in 100-row windows (the endpoint's cap) must
    // yield exactly `total` unique rows — including the last page, with nothing dropped
    // and nothing duplicated. This is the defect the old single 697-row request hit.
    const exported: any[] = [];
    for (let offset = 0; offset < page1.total; offset += 100) {
      exported.push(...(await fetchPage(offset, 100)).rules);
    }
    expect(exported).toHaveLength(page1.total);
    expect(new Set(exported.map((rule: any) => rule.id)).size).toBe(page1.total);
    // Exported order is the documented deterministic sort (non-increasing support).
    for (let i = 1; i < exported.length; i++) {
      expect(exported[i].support).toBeLessThanOrEqual(exported[i - 1].support + 1e-12);
    }
  }, 30000);

  it("returns real per-category values for two stable unit ids and keeps an explicit zero distinct", async () => {
    const { getDashboardView } = await import("../services/dashboardQuery.js");
    const view = await getDashboardView({ year: 2024, state: "all", unitType: "administrative_district", category: "all", view: "compare" });
    const byUnit = (id: string) => new Map(view.observations.filter((o: any) => o.regionId === id).map((o: any) => [o.category, o.cases]));

    const OFFICIAL = "bc8502a9f43a6fdcc5f71ad8"; // Total Cognizable IPC/BNS crimes
    const THEFT = "1d9839523bed898525835c5e";
    const MISC = "bedf72636910b533240a25ca";
    const HURT = "21e25ebe6affc4a855472959";
    const RASH = "fa1d0057cc973abec2f2f281";

    const gondia = byUnit("166ac1c558a511c496eac536"); // Maharashtra · Gondia
    const kamengWest = byUnit("261aacfdf82c6405255c9fa4"); // Arunachal Pradesh · Kameng West

    // Several actual numeric category values for each of the two selected stable units.
    expect(gondia.get(OFFICIAL)).toBe(3922);
    expect(kamengWest.get(OFFICIAL)).toBe(92);
    expect(gondia.get(THEFT)).toBe(393);
    expect(kamengWest.get(THEFT)).toBe(18);
    expect(gondia.get(MISC)).toBe(2109);
    expect(kamengWest.get(MISC)).toBe(8);
    expect(gondia.get(HURT)).toBe(604);
    expect(kamengWest.get(HURT)).toBe(11);
    expect(gondia.get(RASH)).toBe(490);
    expect(kamengWest.get(RASH)).toBe(7);

    // An explicit source zero is carried as the real value 0, not flattened to "missing".
    const cice = byUnit("be299972b0bce1c8ef0e2365"); // Jammu & Kashmir · CICE Jammu
    expect(cice.get(OFFICIAL)).toBe(0);
    // A null source cell is never rendered as zero: this payload contains no nulls, and
    // the frontend's "missing"/"absent" states are only reachable from a null or an
    // omitted row, never from a 0.
    expect(view.observations.some((o: any) => o.cases === null)).toBe(false);
  }, 30000);

  it("agrees across PCA captions, cumulative sum and two-sided loading signs", async () => {
    const { app } = await import("../app.js");
    const pca = (await request(app).get("/api/v1/dashboard?view=pca&year=2024").expect(200)).body.methods.pca.result;

    const evr = pca.explained_variance_ratio;
    const cumulative = pca.cumulative_variance_ratio;
    // The two-decimal captions the cards and axes render come from one variance source.
    expect((evr[0] * 100).toFixed(2)).toBe("15.91");
    expect((evr[1] * 100).toFixed(2)).toBe("4.57");
    expect((cumulative[1] * 100).toFixed(2)).toBe("20.48");
    expect(cumulative[1]).toBeCloseTo(evr[0] + evr[1], 12);

    // Every component has strictly positive and strictly negative loadings, so the
    // positive/negative lists cannot drift to a one-sided (all-positive) picture and a
    // signed value can never render as "+-".
    for (const component of pca.loadings) {
      const values = component.features.map((f: any) => f.loading);
      expect(values.some((v: number) => v > 0)).toBe(true);
      expect(values.some((v: number) => v < 0)).toBe(true);
    }

    // Selecting PC2 plots genuinely different coordinates than PC1.
    const differing = pca.components.some((c: any) => {
      const pc1 = c.scores.find((s: any) => s.component === "PC1").score;
      const pc2 = c.scores.find((s: any) => s.component === "PC2").score;
      return pc1 !== pc2;
    });
    expect(differing).toBe(true);
  }, 30000);

  it("switches actual cluster membership between k=3/4/5 while inertia stays monotone", async () => {
    const { app } = await import("../app.js");
    const results = (await request(app).get("/api/v1/dashboard?view=clusters&year=2024").expect(200)).body.methods.kmeans.results;
    const assignment = (k: string) => new Map<string, number>(results[k].assignment_records.map((r: any) => [r.region_id, r.cluster_id]));

    expect(results["3"].cluster_sizes).toEqual([190, 168, 416]);
    for (const k of ["3", "4", "5"]) {
      expect(results[k].n_regions).toBe(774);
      expect(results[k].assignment_records).toHaveLength(774);
      expect(results[k].cluster_sizes.reduce((a: number, b: number) => a + b, 0)).toBe(774);
    }

    // Membership genuinely switches between models — a k=3 narrative cannot be shown
    // on a k=4/k=5 artifact.
    const k3 = assignment("3"), k4 = assignment("4"), k5 = assignment("5");
    expect([...k3.keys()].filter(id => k3.get(id) !== k4.get(id)).length).toBeGreaterThan(0);
    expect([...k4.keys()].filter(id => k4.get(id) !== k5.get(id)).length).toBeGreaterThan(0);

    const inertia = ["3", "4", "5"].map(k => results[k].inertia);
    expect(inertia[0]).toBeGreaterThan(inertia[1]);
    expect(inertia[1]).toBeGreaterThan(inertia[2]);
  }, 30000);

  it("finds the anomaly examples by stable id and value, and the category filter changes the row set", async () => {
    const { app } = await import("../app.js");
    const rows = (await request(app).get("/api/v1/dashboard?view=anomalies&year=2024").expect(200)).body.methods.anomalies.result as any[];

    // Satara rare example: a single 1 among 773 zeros → z = (N−1)/√N ≈ 27.7849.
    const satara = rows.find(r => r.region_id === "e84f44ae4ef7d2d57c66e0f3" && r.category === "Abetment outside India for offence in India");
    expect(satara).toBeDefined();
    expect(satara.value).toBe(1);
    expect(satara.category_mean).toBe(0);
    expect(satara.z_score).toBeCloseTo(27.7849, 4);

    // North-West Delhi Other Thefts example.
    const northWest = rows.find(r => r.region_id === "dd055ff450e11ba0377132dd" && /Other Thefts/.test(r.category));
    expect(northWest).toBeDefined();
    expect(northWest.value).toBe(13156);
    expect(northWest.z_score).toBeCloseTo(10.8875, 4);

    // The category selector is populated with the analysed categories and changes the set.
    const categories = [...new Set(rows.map(r => r.category))];
    expect(categories).toHaveLength(131);
    const scoped = rows.filter(r => r.category === satara.category);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(rows.length);
    expect(scoped.every(r => r.category === satara.category)).toBe(true);
  }, 30000);

  it("serves quality/methodology counts from active metadata with no stale 145/21022", async () => {
    const { app } = await import("../app.js");
    const meta = (await request(app).get("/api/v1/dashboard?view=methodology&year=2024").expect(200)).body.meta;
    expect(meta.sourceFiles).toBe(144);
    expect(meta.aggregateRows).toBe(20880);
    expect(meta.sourceRows).toBe(567078);
    expect(meta.validRows).toBe(546198);
    expect(meta.sourceFiles).not.toBe(145);
    expect(meta.aggregateRows).not.toBe(21022);

    const quality = (await request(app).get("/api/v1/dashboard?view=quality&year=2024").expect(200)).body.qualitySummary;
    expect(quality.observations).toBe(546198);
    expect(quality.explicitZeros).toBe(323296);
    expect(quality.missing).toBe(0);
  }, 30000);

  it("fails closed on an integrity mismatch and exposes no synthetic values", async () => {
    const { loadCurrentAnalysis } = await import("../services/analysisResults.js");
    // An injected (temporary, in-memory) expected hash that cannot match the frozen
    // dataset must fail the whole bundle closed — never a partial or synthesised result.
    const mismatched = loadCurrentAnalysis("0".repeat(64));
    expect(mismatched.runId).toBeNull();
    for (const key of ["pca", "kmeans", "hierarchical", "anomalies", "association"]) {
      expect(mismatched.methods[key].status).toBe("failed");
      expect(mismatched.methods[key].result).toBeUndefined();
      expect(mismatched.methods[key].results).toBeUndefined();
    }
    // The real pointer still loads, proving the failure above is the injected hash and
    // not a broken repository state.
    const current = loadCurrentAnalysis();
    expect(current.methods.pca.status).toBe("available");
  }, 30000);

  it("preserves the frozen release/run pointers and every consumed artifact hash", async () => {
    const pointer = readJson("data/serving/current.json");
    expect(pointer.release_id).toBe("ncrb-districtwise-2021-2024-ecec48b772bc");
    const release = readJson(`data/serving/releases/${pointer.release_id}/release_manifest.json`);
    expect(sha256(release.sqlite.path)).toBe(release.sqlite.sha256);
    expect(sha256(release.source_dataset.path)).toBe(release.source_dataset.sha256);

    const runPointer = readJson("analysis/output/runs/current.json");
    expect(runPointer.run_id).toBe("ncrb-national-2024-admin-log1p-zscore-20261107-v4");
    const manifest = readJson(runPointer.manifest);
    expect(manifest.run_id).toBe(runPointer.run_id);
    expect(sha256(manifest.feature_input.path)).toBe(manifest.feature_input.sha256);
    const runDir = runPointer.manifest.replace(/\/run_manifest\.json$/, "");
    for (const [relative, hash] of Object.entries(manifest.artifacts ?? {})) {
      expect(sha256(`${runDir}/${relative}`)).toBe(hash);
    }
  }, 30000);
});
