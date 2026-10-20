import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { app } from "../src/app.js";
import {
  connect,
  User,
  Application,
  Assessment,
  Audit,
} from "../src/models.js";
import { safeCsv } from "../src/validation.js";
const uri =
  process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/finrisk-ai-test";
const password = randomBytes(24).toString("base64url");
process.env.JWT_SECRET =
  process.env.JWT_SECRET || randomBytes(48).toString("hex");
const admin = supertest.agent(app),
  analyst = supertest.agent(app),
  reviewer = supertest.agent(app),
  viewer = supertest.agent(app);
const input = {
  applicantId: "TEST-1001",
  applicantName: "Synthetic Test Borrower",
  age: 30,
  employmentType: "Salaried",
  employmentMonths: 60,
  monthlyIncome: 85000,
  monthlyExpenses: 23000,
  existingDebt: 150000,
  existingEmi: 5000,
  creditScore: 760,
  loanPurpose: "Personal",
  loanAmount: 400000,
  tenureMonths: 36,
  interestRate: 10,
  currency: "INR",
};
let id: string;
before(async () => {
  assert.match(
    uri,
    /test(?:[?\/_-]|$)/,
    "Integration tests require a database with test in its name",
  );
  await connect(uri);
  await mongoose.connection.dropDatabase();
  for (const [name, role] of [
    ["admin", "Administrator"],
    ["analyst", "Risk Analyst"],
    ["reviewer", "Reviewer"],
    ["viewer", "Read-Only Viewer"],
  ])
    await User.create({
      name,
      email: `${name}@test.invalid`,
      role,
      passwordHash: await bcrypt.hash(password, 4),
    });
});
after(async () => {
  await new Promise((r) => setTimeout(r, 200));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test("authentication, origin checks and session confidentiality", async () => {
  await supertest(app).get("/api/v1/applications").expect(401);
  await supertest(app)
    .post("/api/v1/auth/login")
    .send({ email: "admin@test.invalid", password: "wrong" })
    .expect(401);
  await supertest(app)
    .post("/api/v1/auth/login")
    .set("Origin", "https://untrusted.invalid")
    .send({ email: "admin@test.invalid", password })
    .expect(403);
  for (const [agent, name] of [
    [admin, "admin"],
    [analyst, "analyst"],
    [reviewer, "reviewer"],
    [viewer, "viewer"],
  ] as const) {
    const r = await agent
      .post("/api/v1/auth/login")
      .send({ email: `${name}@test.invalid`, password })
      .expect(200);
    assert.ok(r.body.user.id);
    assert.equal(r.body.user.passwordHash, undefined);
    assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  }
  await viewer.get("/api/v1/auth/me").expect(200);
});
test("roles reject viewer writes and analyst administration", async () => {
  await viewer.post("/api/v1/applications").send(input).expect(403);
  await analyst.get("/api/v1/users").expect(403);
  await viewer.get("/api/v1/reports/applications?format=csv").expect(403);
});
test("create retrieve validate submit assess and persist actual model results", async () => {
  const created = await analyst
    .post("/api/v1/applications")
    .send(input)
    .expect(201);
  id = created.body.id;
  assert.equal(created.body.status, "Draft");
  await analyst.post(`/api/v1/applications/${id}/assess`).expect(409);
  await analyst
    .patch(`/api/v1/applications/${id}`)
    .send({ creditScore: 901 })
    .expect(422);
  await analyst.post(`/api/v1/applications/${id}/submit`).expect(200);
  const assessed = await analyst
    .post(`/api/v1/applications/${id}/assess`)
    .expect(201);
  assert.ok(assessed.body.modelVersion);
  assert.ok(assessed.body.probability >= 0 && assessed.body.probability <= 1);
  assert.ok(assessed.body.contributions.length > 0);
  const found = await analyst.get(`/api/v1/applications/${id}`).expect(200);
  assert.equal(found.body.assessments.length, 1);
  assert.equal(found.body.latestAssessment.id, assessed.body.id);
  assert.equal(await Assessment.countDocuments({ applicationId: id }), 1);
  assert.equal((await Application.findById(id))?.status, "Assessed");
  assert.ok(await Audit.exists({ entityId: id, action: "assessment.created" }));
});
test("human reviewer requires recorded reason and analyst cannot decide", async () => {
  await analyst
    .post(`/api/v1/applications/${id}/decision`)
    .send({
      decision: "Approved by Reviewer",
      reason: "A sufficiently long reason",
    })
    .expect(403);
  await reviewer
    .post(`/api/v1/applications/${id}/decision`)
    .send({ decision: "Approved by Reviewer", reason: "short" })
    .expect(422);
  const r = await reviewer
    .post(`/api/v1/applications/${id}/decision`)
    .send({
      decision: "Under Review",
      reason: "Reviewing the synthetic financial obligations",
    })
    .expect(200);
  assert.equal(r.body.status, "Under Review");
  assert.equal(
    r.body.history.at(-1).reason,
    "Reviewing the synthetic financial obligations",
  );
});
test("concurrent assessment locks prevent duplicate inference writes", async () => {
  const before = await Assessment.countDocuments({ applicationId: id });
  const results = await Promise.all([
    analyst.post(`/api/v1/applications/${id}/assess`),
    analyst.post(`/api/v1/applications/${id}/assess`),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await Assessment.countDocuments({ applicationId: id }),
    before + 1,
  );
});
test("saved zero interest scenario compares real model outputs", async () => {
  const r = await analyst
    .post("/api/v1/scenarios")
    .send({
      name: "Zero interest test",
      applicationId: id,
      inputs: {
        ...input,
        loanAmount: 120000,
        tenureMonths: 12,
        interestRate: 0,
      },
    })
    .expect(201);
  assert.ok(r.body.baseline.modelVersion);
  assert.equal(r.body.baselineInputs.loanAmount, input.loanAmount);
  assert.equal(r.body.result.ratios.emi, 10000);
  assert.equal(r.body.result.ratios.totalInterest, 0);
  const listed = await viewer.get("/api/v1/scenarios").expect(200);
  assert.equal(listed.body.total, 1);
  await viewer.get("/api/v1/model").expect(200);
});
test("analytics derive exposure and risk from stored records", async () => {
  const r = await viewer.get("/api/v1/analytics").expect(200);
  assert.equal(r.body.kpis.totalApplications, 1);
  assert.equal(r.body.kpis.totalExposure, input.loanAmount);
  assert.equal(r.body.kpis.assessed, 1);
  assert.ok(r.body.kpis.expectedLoss >= 0);
  assert.equal(r.body.synthetic, true);
});
test("CSV partial failures retain successes and XLSX upload parses real cells", async () => {
  const headers = Object.keys(input);
  const csv = [
    headers.join(","),
    headers.map((k) => input[k as keyof typeof input]).join(","),
    headers
      .map((k) => (k === "monthlyIncome" ? -1 : input[k as keyof typeof input]))
      .join(","),
  ].join("\n");
  const preview = await analyst.post("/api/v1/batches/preview").attach("file", Buffer.from(csv), "synthetic.csv").expect(200);
  assert.deepEqual(preview.body.headers, headers);
  assert.equal(preview.body.rows.length, 2);
  assert.equal(preview.body.total, 2);
  assert.equal(preview.body.errors.length, 1);
  const upload = await analyst
    .post("/api/v1/batches")
    .attach("file", Buffer.from(csv), "synthetic.csv")
    .expect(202);
  let job: any;
  for (let i = 0; i < 100; i++) {
    job = (await analyst.get(`/api/v1/batches/${upload.body.id}`).expect(200))
      .body;
    if (job.status.startsWith("Completed")) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(job.status, "Completed with errors");
  assert.equal(job.results.length, 1);
  assert.equal(job.errors.length, 1);
  await analyst.get(`/api/v1/batches/${job.id}/download`).expect(200);
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet("Data");
  sh.addRow(headers);
  sh.addRow(headers.map((k) => input[k as keyof typeof input]));
  await analyst
    .post("/api/v1/batches")
    .attach("file", Buffer.from(await wb.xlsx.writeBuffer()), "synthetic.xlsx")
    .expect(202);
  await analyst
    .post("/api/v1/batches")
    .attach("file", Buffer.from("fake"), "bad.exe")
    .expect(415);
});
test("alert acknowledgement resolution and audit are persistent", async () => {
  const filteredAlerts = await analyst.get("/api/v1/alerts?severity=Nonexistent").expect(200);
  assert.equal(filteredAlerts.body.total, 0);
  const emptyAudit = await admin.get("/api/v1/audit?search=never-recorded-unique-action").expect(200);
  assert.equal(emptyAudit.body.total, 0);
  const alerts = await analyst.get("/api/v1/alerts").expect(200);
  assert.ok(alerts.body.total > 0);
  const alertId = alerts.body.items[0].id;
  await analyst.post(`/api/v1/alerts/${alertId}/acknowledge`).expect(200);
  const r = await analyst.post(`/api/v1/alerts/${alertId}/resolve`).expect(200);
  assert.equal(r.body.status, "Resolved");
  const logs = await admin.get("/api/v1/audit").expect(200);
  assert.ok(logs.body.items.some((a: any) => a.action === "alert.resolve"));
});
test("PDF CSV XLSX reports contain stored assessment records", async () => {
  for (const format of ["pdf", "csv", "xlsx"]) {
    const r = await analyst
      .get(`/api/v1/reports/assessment?format=${format}&id=${id}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    assert.ok(r.body.length > 20);
    if (format === "pdf")
      assert.equal(r.body.subarray(0, 4).toString(), "%PDF");
    if (format === "csv") assert.match(r.body.toString(), /TEST-1001/);
    if (format === "xlsx") assert.equal(r.body.subarray(0, 2).toString(), "PK");
  }
  assert.equal(safeCsv("=formula"), "'=formula");
});
test("policy thresholds enforce ordering and administrator permissions", async () => {
  const policy = {
    thresholds: [0.1, 0.3, 0.7],
    lgd: 0.45,
    emiAlertThreshold: 0.5,
    notifications: true,
  };
  await analyst.patch("/api/v1/settings").send(policy).expect(403);
  await admin
    .patch("/api/v1/settings")
    .send({ ...policy, thresholds: [0.7, 0.3, 0.1] })
    .expect(422);
  const r = await admin.patch("/api/v1/settings").send(policy).expect(200);
  assert.match(r.body.version, /policy-/);
});
test("financial edits invalidate latest assessment and logout revokes session", async () => {
  const updated = await analyst
    .patch(`/api/v1/applications/${id}`)
    .send({ loanAmount: 350000 })
    .expect(200);
  assert.equal(updated.body.status, "Draft");
  const found = await analyst.get(`/api/v1/applications/${id}`).expect(200);
  assert.equal(found.body.assessments.length, 2);
  assert.ok(!found.body.latestAssessment);
  await analyst.delete(`/api/v1/applications/${id}`).expect(200);
  await analyst.get(`/api/v1/applications/${id}`).expect(404);
  const copilot = await viewer
    .post("/api/v1/copilot")
    .send({ question: "Summarize portfolio" })
    .expect(200);
  assert.equal(copilot.body.mode, "deterministic");
  await viewer.post("/api/v1/auth/logout").expect(200);
  await viewer.get("/api/v1/auth/me").expect(401);
});
