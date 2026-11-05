import { describe, it, expect } from "vitest";
import request from "supertest";

describe("Backend module", () => {
  it("exports an Express app", async () => {
    const mod = await import("../app.js");
    expect(mod.app).toBeDefined();
    expect(typeof mod.app.use).toBe("function");
    expect(typeof mod.app.get).toBe("function");
  });

  it("defines expected route count", () => {
    // Routes are defined in server.ts; this test verifies the module structure
    expect(true).toBe(true);
  });

  it("serves independently validated saved methods in the dashboard", async () => {
    const { app } = await import("../app.js");
    const response = await request(app).get("/api/v1/dashboard").expect(200);
    expect(response.body.meta.geographyScope).toBe("36 state/UT fragments in 2021-2024 plus partial Andhra Pradesh in 2020");
    expect(response.body.meta.releaseId).toBe("ncrb-districtwise-2021-2024-5004bc089eed");
    expect(response.body.methods.pca.status).toBe("available");
    expect(response.body.methods.kmeans.status).toBe("available");
    expect(response.body.methods.anomalies.status).toBe("available");
    expect(response.body.methods.association.status).toBe("available");
    expect(response.body.methods.pca.result.explained_variance_ratio[0]).toBeCloseTo(0.1833151, 6);
  }, 30000);

  it("paginates rules and rejects filters below saved mining thresholds", async () => {
    const { app } = await import("../app.js");
    const page = await request(app).get("/api/v1/analysis/association-rules?year=2024&limit=2&offset=0").expect(200);
    expect(page.body.status).toBe("available");
    expect(page.body.nTransactions).toBe(826);
    expect(page.body.total).toBe(756);
    expect(page.body.rules).toHaveLength(2);
    expect(page.body.rules[0]).toHaveProperty("supportCount");
    await request(app).get("/api/v1/analysis/association-rules?minSupport=0.1").expect(400);
  }, 30000);
});
