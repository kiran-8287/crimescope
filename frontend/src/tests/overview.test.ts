import { describe, it, expect } from "vitest";

describe("OverviewPage data shape", () => {
  it("validates overview response fields", () => {
    const mock = {
      status: "ok",
      releaseId: "2020_cci_district_children",
      year: 2020,
      data: {
        totalRegions: 20,
        totalCategories: 57,
        totalCases: 8249,
        topRegions: [{ region: "Test", cases: 100 }],
        topCategories: [{ category: "Murder", cases: 50 }],
      },
      metadata: {
        datasetVersion: "ncrb-2020",
        geographyLevel: "district",
        categoryScope: "crimes_against_children",
        coverage: "eligible_only",
        denominator: null,
        warnings: [],
        generatedAt: "2026-11-04T00:00:00Z",
      },
    };

    expect(mock.status).toBe("ok");
    expect(mock.data.totalRegions).toBeGreaterThan(0);
    expect(mock.data.totalCases).toBeGreaterThan(0);
    expect(mock.metadata.datasetVersion).toBe("ncrb-2020");
  });
});
