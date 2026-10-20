import { test, expect } from "@playwright/test";
import { login, financialInput } from "./support";

test("persistent application lifecycle, genuine inference, explanation, review and audit", async ({
  request,
}) => {
  await login(request);
  const reference = `E2E-${Date.now()}`;
  let r = await request.post("/api/v1/applications", {
    data: { ...financialInput, applicantId: reference },
  });
  expect(r.status()).toBe(201);
  const app = await r.json();
  const id = app.id || app._id;
  r = await request.get(`/api/v1/applications/${id}`);
  expect((await r.json()).applicantId).toBe(reference);
  r = await request.patch(`/api/v1/applications/${id}`, {
    data: { monthlyIncome: 90000 },
  });
  expect(r.ok()).toBeTruthy();
  r = await request.post(`/api/v1/applications/${id}/submit`, { data: {} });
  expect(r.ok()).toBeTruthy();
  r = await request.post(`/api/v1/applications/${id}/assess`, { data: {} });
  expect(r.status()).toBe(201);
  const assessed = await r.json();
  expect(assessed.probability).toBeGreaterThanOrEqual(0);
  expect(assessed.probability).toBeLessThanOrEqual(1);
  expect(assessed.modelVersion).toContain("synthetic");
  expect(assessed.contributions.length).toBeGreaterThan(0);
  r = await request.get(`/api/v1/applications/${id}`);
  const stored = await r.json();
  expect(stored.status).toBe("Assessed");
  expect(stored.assessments.length).toBe(1);
  r = await request.post(`/api/v1/applications/${id}/decision`, {
    data: {
      decision: "Under Review",
      reason: "Synthetic application routed for an independent human review.",
    },
  });
  expect(r.ok()).toBeTruthy();
  r = await request.post(`/api/v1/applications/${id}/decision`, {
    data: {
      decision: "Approved by Reviewer",
      reason:
        "Synthetic test only: reviewer independently checked the demonstration financial inputs.",
    },
  });
  expect(r.ok()).toBeTruthy();
  r = await request.get(`/api/v1/audit?entityId=${id}`);
  const audit = await r.json();
  expect(
    audit.items.some((a: any) => a.action === "application.updated"),
  ).toBeTruthy();
  expect(
    audit.items.some((a: any) => a.action === "review.recorded"),
  ).toBeTruthy();
  r = await request.get("/api/v1/analytics");
  const analytics = await r.json();
  expect(analytics.kpis.totalApplications).toBeGreaterThan(0);
  expect(analytics.synthetic).toBe(true);
});

test("scenario predictions persist and report exports use actual system data", async ({
  request,
}) => {
  await login(request);
  const r = await request.post("/api/v1/scenarios", {
    data: {
      name: `E2E Scenario ${Date.now()}`,
      inputs: { ...financialInput, monthlyIncome: 120000 },
      baselineInputs: financialInput,
    },
  });
  expect(r.status()).toBe(201);
  const saved = await r.json();
  expect(saved.result.modelVersion).toContain("synthetic");
  expect(saved.baseline.probability).toBeGreaterThanOrEqual(0);
  const scenarios = await (await request.get("/api/v1/scenarios")).json();
  expect(
    scenarios.items.some(
      (s: any) => (s.id || s._id) === (saved.id || saved._id),
    ),
  ).toBeTruthy();
  for (const format of ["pdf", "csv", "xlsx"]) {
    const report = await request.get(
      `/api/v1/reports/portfolio?format=${format}`,
    );
    expect(report.ok(), `export ${format}`).toBeTruthy();
    const buffer = await report.body();
    expect(buffer.length).toBeGreaterThan(100);
    if (format === "pdf") expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    if (format === "xlsx") expect(buffer.subarray(0, 2).toString()).toBe("PK");
  }
});

test("role restrictions enforce access and logout revokes an existing session", async ({
  request,
}) => {
  await login(request, "viewer@finrisk.demo");
  expect(
    (
      await request.post("/api/v1/applications", {
        data: { ...financialInput, applicantId: `DENIED-${Date.now()}` },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/v1/users")).status()).toBe(403);
  expect(
    (await request.get("/api/v1/reports/portfolio?format=csv")).status(),
  ).toBe(403);
  expect((await request.get("/api/v1/applications")).status()).toBe(200);
  expect(
    (await request.post("/api/v1/auth/logout", { data: {} })).ok(),
  ).toBeTruthy();
  expect((await request.get("/api/v1/applications")).status()).toBe(401);
});

test("CSV batch preserves successful predictions and reports invalid rows; alerts have an audited lifecycle", async ({
  request,
}) => {
  await login(request);
  const columns = [
    "applicantName",
    "applicantId",
    "age",
    "monthlyIncome",
    "monthlyExpenses",
    "existingDebt",
    "existingEmi",
    "creditScore",
    "loanAmount",
    "tenureMonths",
    "interestRate",
    "employmentMonths",
    "employmentType",
    "loanPurpose",
    "currency",
  ];
  const valid = { ...financialInput, applicantId: `BATCH-${Date.now()}` };
  const invalid = {
    ...valid,
    applicantId: `INVALID-${Date.now()}`,
    monthlyIncome: -5,
  };
  const csv = [
    columns.join(","),
    ...([valid, invalid] as any[]).map((row) =>
      columns.map((k) => row[k]).join(","),
    ),
  ].join("\n");
  const preview = await request.post("/api/v1/batches/preview", {
    multipart: {
      file: {
        name: "preview.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      },
    },
  });
  expect(preview.ok()).toBeTruthy();
  const previewData = await preview.json();
  expect(previewData.total).toBe(2);
  expect(previewData.headers).toContain("monthlyIncome");
  expect(previewData.errors).toHaveLength(1);
  let r = await request.post("/api/v1/batches", {
    multipart: {
      file: {
        name: "workflow-test.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      },
    },
  });
  expect(r.status()).toBe(202);
  const job = await r.json();
  const id = job.id || job._id;
  let current: any;
  await expect
    .poll(
      async () => {
        current = await (await request.get(`/api/v1/batches/${id}`)).json();
        return current.status;
      },
      { timeout: 30000 },
    )
    .toMatch(/Completed/);
  expect(current.results).toHaveLength(1);
  expect(current.errors).toHaveLength(1);
  expect(current.results[0].modelVersion).toContain("synthetic");
  const download = await request.get(`/api/v1/batches/${id}/download`);
  expect(download.ok()).toBeTruthy();
  expect((await download.body()).length).toBeGreaterThan(100);
  let alerts: any[] = [];
  await expect
    .poll(async () => {
      const response = await (
        await request.get("/api/v1/alerts?limit=100")
      ).json();
      alerts = response.items;
      return alerts.some((a) => a.jobId === id);
    })
    .toBeTruthy();
  const alert = alerts.find((a) => a.jobId === id);
  const alertId = alert.id || alert._id;
  r = await request.post(`/api/v1/alerts/${alertId}/acknowledge`, { data: {} });
  expect((await r.json()).status).toBe("Acknowledged");
  r = await request.post(`/api/v1/alerts/${alertId}/resolve`, { data: {} });
  expect((await r.json()).status).toBe("Resolved");
});
