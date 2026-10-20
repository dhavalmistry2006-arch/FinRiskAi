import { config } from "./config.js";
import {
  Alert,
  Application,
  Assessment,
  Audit,
  ModelVersion,
  Settings,
} from "./models.js";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function ml(path: string, body?: unknown) {
  try {
    const response = await fetch(config.ml + path, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        ...(process.env.ML_SERVICE_KEY
          ? { "X-Service-Key": process.env.ML_SERVICE_KEY }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new HttpError(
        502,
        `Model service returned ${response.status}`,
        await response.json().catch(() => null),
      );
    const result = (await response.json()) as any;
    if (
      ["/predict", "/explain"].includes(path) &&
      typeof result.probability === "number"
    ) {
      const p = await policy();
      const t = p.thresholds;
      result.riskBand =
        result.probability < t[0]
          ? "Low"
          : result.probability < t[1]
            ? "Moderate"
            : result.probability < t[2]
              ? "Elevated"
              : "High";
      result.thresholdVersion = p.version;
    }
    return result;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      "Model service unavailable. No prediction has been generated.",
    );
  }
}
export async function audit(
  req: any,
  action: string,
  entity: string,
  entityId?: string,
  details?: unknown,
) {
  await Audit.create({
    actor: req.user?.id,
    actorName: req.user?.name || "System",
    action,
    entity,
    entityId,
    details,
    requestId: req.id,
  });
}
export async function policy() {
  return (
    (await Settings.findOne({ key: "riskPolicy" }).lean())?.value || {
      version: "demo-1",
      thresholds: [0.15, 0.35, 0.6],
      lgd: 0.45,
      emiAlertThreshold: 0.5,
      notifications: true,
    }
  );
}
export async function assessApplication(app: any, req: any) {
  if (!["Submitted", "Assessed", "Under Review"].includes(app.status))
    throw new HttpError(
      409,
      "Submit a complete application before assessment. Final reviewer decisions cannot be reassessed.",
    );
  const original = app.status;
  const locked = await Application.findOneAndUpdate(
    {
      _id: app._id,
      status: { $in: ["Submitted", "Assessed", "Under Review"] },
    },
    { $set: { status: "Processing" } },
    { new: true },
  );
  if (!locked)
    throw new HttpError(
      409,
      "An assessment is already running or the application state changed",
    );
  app = locked;
  let created: any = null;
  let finalized = false;
  try {
    const output = await ml("/predict", app.toObject());
    if (
      typeof output.probability !== "number" ||
      !Number.isFinite(output.probability) ||
      output.probability < 0 ||
      output.probability > 1
    )
      throw new HttpError(502, "Model returned an invalid probability");
    const p = await policy();
    const t = p.thresholds;
    output.riskBand =
      output.probability < t[0]
        ? "Low"
        : output.probability < t[1]
          ? "Moderate"
          : output.probability < t[2]
            ? "Elevated"
            : "High";
    const assessment = await Assessment.create({
      ...output,
      raw: output,
      applicationId: app._id,
      thresholdVersion: p.version,
    });
    created = assessment;
    app.latestAssessment = assessment._id;
    app.status = "Assessed";
    app.history.push({
      state: app.status,
      reason:
        "Model inference completed; human review required for lending decisions",
      actor: req.user.name,
    });
    await app.save();
    finalized = true;
    await audit(req, "assessment.created", "application", String(app._id), {
      modelVersion: output.modelVersion,
      assessmentId: assessment.id,
    });
    await ModelVersion.updateOne(
      { version: output.modelVersion },
      {
        $setOnInsert: {
          version: output.modelVersion,
          metadata: {
            version: output.modelVersion,
            source: "ML service inference",
          },
        },
      },
      { upsert: true },
    );
    if (
      p.notifications &&
      (output.probability >= t[2] ||
        output.ratios?.emiToIncome > p.emiAlertThreshold)
    )
      await Alert.updateOne(
        { key: `risk:${app.id}` },
        {
          $set: {
            severity: "High",
            category: "Credit risk",
            message: `${app.applicantId}: elevated illustrative risk or EMI burden requires review`,
            applicationId: app._id,
            status: "Open",
          },
          $push: { history: { action: "Triggered", at: new Date() } },
        },
        { upsert: true },
      );
    return assessment;
  } catch (error) {
    if (!finalized) {
      if (created) await Assessment.deleteOne({ _id: created._id });
      await Application.updateOne(
        { _id: app._id, status: "Processing" },
        { $set: { status: original } },
      );
    }
    await Alert.updateOne(
      { key: "model-unavailable" },
      {
        $set: {
          severity: "High",
          category: "Service",
          message: "Model assessment failed; inspect ML service health",
          status: "Open",
        },
      },
      { upsert: true },
    );
    throw error;
  }
}
export async function analytics(query: any = {}) {
  const selectedCurrency = ["INR", "USD", "EUR", "GBP"].includes(query.currency)
    ? query.currency
    : "INR";
  const match: any = { currency: selectedCurrency };
  if (query.status) match.status = query.status;
  if (query.loanPurpose) match.loanPurpose = query.loanPurpose;
  if (query.from || query.to) {
    match.createdAt = {};
    if (query.from) match.createdAt.$gte = new Date(query.from);
    if (query.to) match.createdAt.$lte = new Date(query.to);
  }
  let apps: any[] = await Application.find(match)
    .populate("latestAssessment")
    .sort({ createdAt: -1 })
    .lean();
  if (query.riskBand)
    apps = apps.filter((a) => a.latestAssessment?.riskBand === query.riskBand);
  const p = await policy();
  const assessed = apps.filter((a) => a.latestAssessment);
  const groups = (
    key: (a: any) => string,
    value: (a: any) => number = () => 1,
  ) =>
    Object.entries(
      apps.reduce(
        (acc, a) => {
          const k = key(a) || "Unknown";
          acc[k] = (acc[k] || 0) + value(a);
          return acc;
        },
        {} as Record<string, number>,
      ),
    ).map(([name, value]) => ({ name, value }));
  const exposure = apps.reduce((s, a) => s + (a.loanAmount || 0), 0);
  const expectedLoss = assessed.reduce(
    (s, a) => s + a.latestAssessment.probability * p.lgd * (a.loanAmount || 0),
    0,
  );
  return {
    synthetic: true,
    currency: selectedCurrency,
    assumptions: {
      lgd: p.lgd,
      ead: "Requested principal; not drawn balance",
      probability:
        "Synthetic illustrative model output; not validated default probability",
    },
    kpis: {
      totalApplications: apps.length,
      totalExposure: exposure,
      underReview: apps.filter((a) =>
        ["Under Review", "Submitted"].includes(a.status),
      ).length,
      highRisk: assessed.filter((a) => a.latestAssessment.riskBand === "High")
        .length,
      averageProbability: assessed.length
        ? assessed.reduce((s, a) => s + a.latestAssessment.probability, 0) /
          assessed.length
        : null,
      approvalRate: apps.filter((a) => a.status.endsWith("by Reviewer")).length
        ? apps.filter((a) => a.status === "Approved by Reviewer").length /
          apps.filter((a) => a.status.endsWith("by Reviewer")).length
        : null,
      expectedLoss,
      assessed: assessed.length,
    },
    riskDistribution: groups(
      (a) => a.latestAssessment?.riskBand || "Unassessed",
    ),
    exposureByRisk: groups(
      (a) => a.latestAssessment?.riskBand || "Unassessed",
      (a) => a.loanAmount || 0,
    ),
    volumeOverTime: groups((a) => a.createdAt.toISOString().slice(0, 10)).sort(
      (a, b) => a.name.localeCompare(b.name),
    ),
    loanPurposes: groups((a) => a.loanPurpose),
    creditDistribution: groups((a) =>
      a.creditScore
        ? `${Math.floor(a.creditScore / 100) * 100}–${Math.floor(a.creditScore / 100) * 100 + 99}`
        : "Not provided",
    ),
    decisionDistribution: groups((a) => a.status),
    borrowerSegments: groups((a) => a.employmentType),
    concentration: groups(
      (a) => a.loanPurpose,
      (a) => a.loanAmount || 0,
    ),
    riskTrend: assessed.map((a) => ({
      date: a.createdAt.toISOString().slice(0, 10),
      probability: a.latestAssessment.probability,
      applicantId: a.applicantId,
    })),
    topRiskDrivers: aggregateContributions(assessed),
    recentApplications: apps.slice(0, 10),
    applications: apps,
  };
}
function aggregateContributions(apps: any[]) {
  const sums: Record<string, number> = {};
  for (const a of apps)
    for (const c of a.latestAssessment?.contributions || []) {
      sums[c.feature] = (sums[c.feature] || 0) + Math.abs(c.contribution || 0);
    }
  return Object.entries(sums)
    .map(([name, value]) => ({
      name,
      value: apps.length ? value / apps.length : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export async function recoverApplicationAssessments() {
  const pending = await Application.find({ status: "Processing" });
  for (const app of pending) {
    const last = await Assessment.findOne({
      applicationId: app._id,
      createdAt: { $gte: app.updatedAt },
    }).sort({ createdAt: -1 });
    app.status = last ? "Assessed" : "Submitted";
    if (last) app.latestAssessment = last._id;
    app.history.push({
      state: app.status,
      reason: last
        ? "Recovered saved assessment after server restart"
        : "Assessment interrupted by server restart; resubmit for inference",
      actor: "System recovery",
    });
    await app.save();
    await Audit.create({
      actorName: "System recovery",
      action: "assessment.recovered",
      entity: "application",
      entityId: app.id,
      details: { assessmentId: last?.id },
    });
  }
}
