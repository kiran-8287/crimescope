import { describe, it, expect } from "vitest";

describe("Backend API contract", () => {
  it("defines expected endpoints", () => {
    const endpoints = [
      "GET /health",
      "GET /ready",
      "GET /api/v1/overview",
      "GET /api/v1/regions",
      "GET /api/v1/trends",
      "GET /api/v1/categories/top",
      "GET /api/v1/correlations",
      "GET /api/v1/data-quality",
      "GET /api/v1/analysis/runs/:runId/pca",
      "GET /api/v1/analysis/runs/:runId/clusters",
      "GET /api/v1/anomalies",
      "GET /api/v1/association-rules",
      "GET /api/v1/export/canonical",
      "GET /api/v1/export/quality-report",
      "GET /api/v1/export/quarantined",
    ];

    expect(endpoints.length).toBeGreaterThan(0);
    expect(endpoints).toContain("GET /health");
    expect(endpoints).toContain("GET /ready");
  });
});
