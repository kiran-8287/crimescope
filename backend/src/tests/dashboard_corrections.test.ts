import { describe, it, expect } from "vitest";
import request from "supertest";

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
});
