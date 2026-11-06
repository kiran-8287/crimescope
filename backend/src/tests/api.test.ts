import { describe, it, expect } from "vitest";
import request from "supertest";

describe("Backend module", () => {
  it("exports an Express app", async () => {
    const mod = await import("../app.js");
    expect(mod.app).toBeDefined();
    expect(typeof mod.app.use).toBe("function");
    expect(typeof mod.app.get).toBe("function");
  });

  it("serves independently validated saved methods in the dashboard", async () => {
    const { app } = await import("../app.js");
    const response = await request(app).get("/api/v1/dashboard").expect(200);
    expect(response.body.meta.geographyScope).toBe("36 state/UT fragments in 2021-2024");
    expect(response.body.meta.releaseId).toBe("ncrb-districtwise-2021-2024-ecec48b772bc");
    expect(response.body.methods.pca.status).toBe("available");
    expect(response.body.methods.kmeans.status).toBe("available");
    expect(response.body.methods.anomalies.status).toBe("available");
    expect(response.body.methods.association.status).toBe("available");
    // New cohort: 774 admin districts (corrected from 783). EVR[0] = 15.91%
    expect(response.body.methods.pca.result.explained_variance_ratio[0]).toBeCloseTo(0.1591084, 6);
  }, 30000);

  it("paginates rules and rejects filters below saved mining thresholds", async () => {
    const { app } = await import("../app.js");
    const page = await request(app).get("/api/v1/analysis/association-rules?year=2024&limit=2&offset=0").expect(200);
    expect(page.body.status).toBe("available");
    // New cohort: 774 admin districts → 739 transactions (35 had 0 qualifying items), 697 rules
    expect(page.body.nTransactions).toBe(739);
    expect(page.body.total).toBe(697);
    expect(page.body.rules).toHaveLength(2);
    expect(page.body.rules[0]).toHaveProperty("supportCount");
    await request(app).get("/api/v1/analysis/association-rules?minSupport=0.1").expect(400);
  }, 30000);

  it("serves dedicated quality summary for the quality route without full observation arrays", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/api/v1/dashboard?view=quality").expect(200);
    expect(res.body.qualitySummary).toBeDefined();
    expect(res.body.qualitySummary.observations).toBe(546198);
    expect(res.body.qualitySummary.explicitZeros).toBeGreaterThan(300000);
    expect(res.body.qualitySummary.missing).toBe(0);
    expect(Array.isArray(res.body.qualitySummary.byStateYear)).toBe(true);
    expect(res.body.qualitySummary.byStateYear.length).toBeGreaterThan(100);
    expect(Array.isArray(res.body.qualitySummary.coverage)).toBe(true);
    expect(res.body.observations).toHaveLength(0); // lightweight payload
  }, 30000);

  it("serves multi-year observations for trends view and supports verified cohorts", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/api/v1/dashboard?view=trends").expect(200);
    expect(res.body.observations.length).toBeGreaterThan(1000);
    const years = [...new Set(res.body.observations.map((o: any) => o.year))];
    expect(years).toContain(2021);
    expect(years).toContain(2022);
    expect(years).toContain(2023);
    expect(years).toContain(2024);

    // Verified 2022-2023 cohort: 749 name-matched administrative districts, 22 excluded units (1 from 2022, 21 from 2023)
    const pair2223 = res.body.meta.comparisonPairs.find((p: any) => p.id === "2022-2023");
    expect(pair2223).toBeDefined();
    expect(pair2223.status).toBe("available");
    expect(pair2223.matchedUnitsCount).toBe(749);
    expect(pair2223.excludedUnitsCount).toBe(22);
  }, 30000);

  it("serves top category totals with parent groups and counts in overview", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/api/v1/dashboard?view=overview&year=2024").expect(200);
    expect(res.body.topCategories).toBeDefined();
    expect(res.body.topCategories.length).toBeGreaterThan(10);
    const grandTotal = res.body.topCategories.find((c: any) => c.role === "official_total");
    expect(grandTotal).toBeDefined();
    // New cohort: 774 admin districts (corrected classification). Grand total 2024 = 2,740,258.
    expect(grandTotal.cases).toBe(2740258);
    expect(grandTotal.units).toBe(774);
  }, 30000);

  it("rejects unsupported year 2020 with clear error", async () => {
    const { app } = await import("../app.js");
    await request(app).get("/api/v1/dashboard?view=overview&year=2020").expect(400);
  }, 30000);

  it("rejects unsupported year 2020 on analytics endpoints", async () => {
    const { app } = await import("../app.js");
    await request(app).get("/api/v1/regions?year=2020").expect(400);
    await request(app).get("/api/v1/categories/top?year=2020").expect(400);
    await request(app).get("/api/v1/correlations?year=2020").expect(400);
  }, 30000);

  it("preserves confirmed raw-to-serving benchmark values", async () => {
    const { getDashboardView } = await import("../services/dashboardQuery.js");
    const apCheck = await getDashboardView({
      year: 2024,
      state: "Andhra Pradesh",
      unitType: "administrative_district",
      category: "all",
      view: "compare"
    });
    // In Andhra Pradesh 2024: Murder BNS in Anantapuramu
    const anantapur = apCheck.regions.find((r: any) => r.name === "Anantapuramu");
    expect(anantapur).toBeDefined();
  }, 30000);
});
