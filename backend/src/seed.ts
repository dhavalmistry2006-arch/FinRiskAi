import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config, logger } from "./config.js";
import {
  connect,
  User,
  Application,
  Audit,
  Scenario,
  Alert,
} from "./models.js";
import { assessApplication } from "./services.js";
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    "Set DEMO_PASSWORD to at least 12 characters before seeding. No default password is provided.",
  );
await connect(config.mongo);
const accounts = [
  ["admin", "Demo Administrator", "Administrator"],
  ["analyst", "Demo Risk Analyst", "Risk Analyst"],
  ["reviewer", "Demo Reviewer", "Reviewer"],
  ["viewer", "Demo Viewer", "Read-Only Viewer"],
];
for (const [handle, name, role] of accounts)
  await User.updateOne(
    { email: `${handle}@finrisk.demo` },
    {
      $setOnInsert: {
        name,
        role,
        passwordHash: await bcrypt.hash(password, 12),
        active: true,
        tokenVersion: 0,
      },
    },
    { upsert: true },
  );
const actor = await User.findOne({ email: "admin@finrisk.demo" });
if (!actor) throw new Error("Seed actor missing");
const request = { user: actor.toJSON(), id: "demo-seed" };
let seed = 42;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const purposes = [
  "Personal",
  "Home",
  "Education",
  "Business",
  "Vehicle",
  "Other",
];
const employment = ["Salaried", "Self-employed", "Contract", "Retired"];
for (let i = 0; i < 72; i++) {
  const income = Math.round(18000 + random() * 180000);
  const score = Math.round(320 + random() * 570);
  const amount = Math.round(50000 + random() * 1800000);
  const createdAt = new Date(Date.UTC(2026, 0, 1 + i * 3));
  const inputs = {
    applicantId: `DEMO-${String(i + 1).padStart(4, "0")}`,
    applicantName: `Synthetic Applicant ${String(i + 1).padStart(3, "0")}`,
    age: 25 + (i % 36),
    employmentType: employment[i % employment.length],
    employmentMonths: Math.round(random() * 160),
    monthlyIncome: income,
    monthlyExpenses: Math.round(income * (0.2 + random() * 0.55)),
    existingDebt: Math.round(random() * 900000),
    existingEmi: Math.round(income * random() * 0.55),
    creditScore: score,
    loanPurpose: purposes[i % purposes.length],
    loanAmount: amount,
    tenureMonths: [12, 24, 36, 60, 120, 240][i % 6],
    interestRate: 8 + (i % 12),
    currency: "INR",
    synthetic: true,
  };
  if (await Application.exists({ applicantId: inputs.applicantId })) continue;
  const doc = await Application.create({
    ...inputs,
    createdAt,
    updatedAt: createdAt,
    status: i % 9 === 0 ? "Draft" : "Submitted",
    createdBy: actor._id,
    history: [
      {
        state: "Draft",
        reason: "Deterministic synthetic seed",
        actor: "Demo seed",
        at: createdAt,
      },
      {
        state: i % 9 === 0 ? "Draft" : "Submitted",
        reason: "Synthetic demonstration workflow",
        actor: "Demo seed",
        at: createdAt,
      },
    ],
  });
  if (i % 9 !== 0) {
    const assessment = await assessApplication(doc, request);
    if (i % 4 === 0) {
      doc.status = "Under Review";
      doc.history.push({
        state: doc.status,
        reason: "Synthetic record routed to human review",
        actor: "Demo seed",
      });
      await Alert.updateOne(
        { key: `review:${doc.id}` },
        {
          $setOnInsert: {
            severity: "Medium",
            category: "Review",
            message: `${doc.applicantId} awaits a reviewer decision`,
            applicationId: doc._id,
            status: "Open",
          },
        },
        { upsert: true },
      );
    } else if (i % 7 === 0) {
      doc.status = "Approved by Reviewer";
      doc.history.push({
        state: doc.status,
        reason:
          "Synthetic demonstration reviewer decision, not model automation",
        actor: "Demo Reviewer",
      });
    } else if (i % 11 === 0) {
      doc.status = "Rejected by Reviewer";
      doc.history.push({
        state: doc.status,
        reason:
          "Synthetic demonstration reviewer decision, not model automation",
        actor: "Demo Reviewer",
      });
    }
    await doc.save();
    if (i === 1)
      await Scenario.create({
        name: "Demonstration: reduced principal",
        applicationId: doc._id,
        inputs: { ...inputs, loanAmount: Math.round(amount * 0.8) },
        baseline: assessment.toJSON(),
        result: await (
          await import("./services.js")
        ).ml("/predict", { ...inputs, loanAmount: Math.round(amount * 0.8) }),
        createdBy: actor._id,
      });
  }
}
await Audit.create({
  actor: actor._id,
  actorName: actor.name,
  action: "demo.seeded",
  entity: "system",
  details: {
    synthetic: true,
    records: await Application.countDocuments({ synthetic: true }),
  },
});
logger.info(
  {
    accounts: accounts.map((a) => `${a[0]}@finrisk.demo`),
    applications: await Application.countDocuments(),
  },
  "Synthetic demo seed complete; password is provided through DEMO_PASSWORD",
);
await mongoose.disconnect();
