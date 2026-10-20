import { request } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3001";
const files = process.argv.slice(2);
if (!files.length)
  throw new Error(
    "Pass the compose file(s) for the test stack; never target a production deployment.",
  );
const compose = ["compose", ...files.flatMap((f) => ["-f", f])];
const run = (...args) =>
  execFileSync("docker", [...compose, ...args], {
    stdio: "pipe",
    env: process.env,
    timeout: 60000,
  });
const password =
  process.env.DEMO_PASSWORD ||
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DEMO_PASSWORD="))
    .slice(14);
const client = await request.newContext({ baseURL, timeout: 10000 });
const wait = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await client.get("/api/v1/model");
      if (r.ok()) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Model/API did not recover");
};
let stopped = false;
try {
  assert.equal(
    (
      await client.post("/api/v1/auth/login", {
        data: { email: "admin@finrisk.demo", password },
      })
    ).status(),
    200,
  );
  const inputs = {
    applicantName: "Synthetic Recovery Test",
    applicantId: `RECOVERY-${Date.now()}`,
    age: 34,
    employmentType: "Salaried",
    employmentMonths: 72,
    monthlyIncome: 80000,
    monthlyExpenses: 25000,
    existingDebt: 100000,
    existingEmi: 5000,
    creditScore: 760,
    loanPurpose: "Personal",
    loanAmount: 350000,
    tenureMonths: 36,
    interestRate: 10,
    currency: "INR",
  };
  let r = await client.post("/api/v1/applications", { data: inputs });
  assert.equal(r.status(), 201);
  const created = await r.json();
  const id = created.id;
  assert.equal(
    (
      await client.post(`/api/v1/applications/${id}/submit`, { data: {} })
    ).status(),
    200,
  );
  r = await client.post(`/api/v1/applications/${id}/assess`, { data: {} });
  assert.equal(r.status(), 201);
  const original = await r.json();
  run("stop", "ml-service");
  stopped = true;
  r = await client.post(`/api/v1/applications/${id}/assess`, { data: {} });
  assert.equal(r.status(), 503);
  assert.equal((await r.json()).probability, undefined);
  const failed = await (await client.get(`/api/v1/applications/${id}`)).json();
  assert.equal(failed.status, "Assessed");
  assert.equal(failed.assessments.length, 1);
  run("start", "ml-service");
  stopped = false;
  await wait();
  run("restart", "mongodb", "ml-service", "backend", "frontend");
  await wait();
  const restored = await (
    await client.get(`/api/v1/applications/${id}`)
  ).json();
  assert.equal(restored.applicantId, inputs.applicantId);
  assert.equal(restored.assessments.length, 1);
  assert.equal(restored.latestAssessment.id, original.id);
  assert.equal(restored.latestAssessment.probability, original.probability);
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/recovery.json",
    JSON.stringify(
      {
        passed: true,
        applicationId: id,
        checks: [
          "ML unavailable returns503 without fabricated probability",
          "Failed reassessment preserves prior assessment and lifecycle",
          "Mongo/ML/API/frontend restart preserves record,assessment and session",
        ],
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: model outage fails explicitly; assessment state and MongoDB records survive all service restarts.",
  );
} finally {
  if (stopped) run("start", "ml-service");
  await client.dispose();
}
