import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { config, logger } from "./config.js";
import {
  Application,
  Assessment,
  User,
  Scenario,
  Batch,
  Alert,
  Audit,
  Settings,
  roles,
} from "./models.js";
import {
  authenticate,
  analysts,
  reviewers,
  exporters,
  admins,
  cookieOptions,
  issueToken,
} from "./auth.js";
import { inputSchema, draftSchema, pagination } from "./validation.js";
import {
  HttpError,
  audit,
  assessApplication,
  analytics,
  ml,
  policy,
} from "./services.js";
import { batchRouter, recoverBatchJobs } from "./batch.js";
import { reportRouter } from "./reports.js";
import { openapi } from "./openapi.js";
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.origins.includes(origin)) callback(null, true);
      else callback(new HttpError(403, "Origin is not allowed"));
    },
    credentials: true,
  }),
);
app.use((req: any, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-ID", req.id);
  const started = Date.now();
  res.on("finish", () =>
    logger.info(
      {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl.split("?")[0],
        status: res.statusCode,
        durationMs: Date.now() - started,
      },
      "request",
    ),
  );
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && !config.origins.includes(origin))
      return next(new HttpError(403, "Untrusted request origin"));
    if (req.headers["sec-fetch-site"] === "cross-site")
      return next(new HttpError(403, "Cross-site write rejected"));
  }
  next();
});
app.get("/health", async (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  let model = false;
  try {
    const health = await ml("/health");
    model = health.modelLoaded === true;
  } catch {}
  res
    .status(connected && model ? 200 : 503)
    .json({
      status: connected && model ? "ok" : "degraded",
      database: connected ? "connected" : "disconnected",
      model: model ? "available" : "unavailable",
      version: "2.0.0",
    });
});
app.get("/api/v1/openapi.json", (_req, res) => res.json(openapi));
app.use(
  "/api/v1/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: false } }),
);
const api = express.Router();
app.use("/api/v1", api);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many login attempts. Try again later." } },
});
api.post("/auth/login", loginLimiter, async (req: any, res) => {
  const data = z
    .object({
      email: z
        .string()
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(1).max(200),
    })
    .parse(req.body);
  const user = await User.findOne({ email: data.email }).select(
    "+passwordHash",
  );
  const valid = user
    ? await bcrypt.compare(data.password, user.passwordHash)
    : await bcrypt.compare(
        data.password,
        "$2b$12$9BawjvSe2HWqHtkTtK67G.FtIqQsvxnvM.lor3hXQnNbvXoAdY3HG",
      );
  if (!user || !valid || !user.active)
    throw new HttpError(401, "Invalid email or password");
  req.user = user.toJSON();
  res.cookie("finrisk_session", issueToken(user), cookieOptions);
  await audit(req, "auth.login", "user", user.id);
  res.json({ user: user.toJSON() });
});
api.use(authenticate);
api.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { message: "Request rate exceeded" } },
  }),
);
api.get("/auth/me", (req: any, res) => res.json({ user: req.user }));
api.post("/auth/logout", async (req: any, res) => {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  await audit(req, "auth.logout", "user", req.user.id);
  res.clearCookie("finrisk_session", { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});
api.post("/auth/password", async (req: any, res) => {
  const data = z
    .object({
      currentPassword: z.string(),
      password: z.string().min(12).max(128),
    })
    .parse(req.body);
  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(data.currentPassword, user.passwordHash)))
    throw new HttpError(403, "Current password is incorrect");
  user.passwordHash = await bcrypt.hash(data.password, 12);
  user.tokenVersion += 1;
  await user.save();
  res.clearCookie("finrisk_session");
  await audit(req, "auth.passwordChanged", "user", user.id);
  res.json({ ok: true });
});
async function list(
  model: any,
  req: any,
  res: any,
  filter: any = {},
  populate?: string,
) {
  const { page, limit, skip } = pagination(req.query);
  let q = model
    .find(filter)
    .sort({
      [[
        "createdAt",
        "updatedAt",
        "loanAmount",
        "applicantName",
        "status",
      ].includes(req.query.sort)
        ? req.query.sort
        : "createdAt"]: (req.query.direction || req.query.order) === "asc" ? 1 : -1,
    })
    .skip(skip)
    .limit(limit);
  if (populate) q = q.populate(populate);
  const [items, total] = await Promise.all([q, model.countDocuments(filter)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}
function objectId(id: string) {
  if (!mongoose.isValidObjectId(id))
    throw new HttpError(400, "Invalid record identifier");
  return id;
}
async function application(id: string): Promise<any> {
  const doc = await Application.findById(objectId(id));
  if (!doc) throw new HttpError(404, "Application not found");
  return doc;
}
api.get("/applications", async (req: any, res) => {
  const filter: any = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.loanPurpose) filter.loanPurpose = req.query.loanPurpose;
  if (req.query.search) {
    const escaped = String(req.query.search)
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { applicantName: { $regex: escaped, $options: "i" } },
      { applicantId: { $regex: escaped, $options: "i" } },
    ];
  }
  if (req.query.riskBand) {
    const ids = await Assessment.find({
      riskBand: req.query.riskBand,
    }).distinct("_id");
    filter.latestAssessment = { $in: ids };
  }
  await list(Application, req, res, filter, "latestAssessment");
});
api.post("/applications", analysts, async (req: any, res) => {
  const data = draftSchema.parse(req.body);
  const doc = await Application.create({
    ...data,
    status: "Draft",
    createdBy: req.user.id,
    synthetic: true,
    history: [
      { state: "Draft", reason: "Application created", actor: req.user.name },
    ],
  });
  await audit(req, "application.created", "application", doc.id);
  res.status(201).json(doc);
});
api.get("/applications/:id", async (req, res) => {
  const doc = await application(req.params.id);
  await doc.populate("latestAssessment");
  const assessments = await Assessment.find({ applicationId: doc._id }).sort({
    createdAt: -1,
  });
  res.json({ ...doc.toJSON(), assessments });
});
api.patch("/applications/:id", analysts, async (req: any, res) => {
  const doc = await application(req.params.id);
  if (!["Draft", "Assessed", "Under Review"].includes(doc.status))
    throw new HttpError(
      409,
      "Application cannot be edited in its current state",
    );
  const data = draftSchema.partial().parse(req.body);
  Object.assign(doc, data);
  if (doc.status !== "Draft") {
    doc.status = "Draft";
    doc.latestAssessment = undefined;
  }
  doc.history.push({
    state: doc.status,
    reason: "Financial inputs updated; reassessment required",
    actor: req.user.name,
  });
  await doc.save();
  await audit(req, "application.updated", "application", doc.id, {
    fields: Object.keys(data),
  });
  res.json(doc);
});
api.delete("/applications/:id", analysts, async (req: any, res) => {
  const doc = await application(req.params.id);
  if (doc.status !== "Draft")
    throw new HttpError(
      409,
      "Only drafts can be deleted. Withdraw submitted records.",
    );
  await Assessment.deleteMany({ applicationId: doc._id });
  await doc.deleteOne();
  await audit(req, "application.deleted", "application", doc.id);
  res.json({ ok: true });
});
api.post("/applications/:id/submit", analysts, async (req: any, res) => {
  const doc = await application(req.params.id);
  if (doc.status !== "Draft")
    throw new HttpError(409, "Only draft applications can be submitted");
  inputSchema.parse(doc.toObject());
  doc.status = "Submitted";
  doc.history.push({
    state: doc.status,
    reason: "Validated and submitted for assessment",
    actor: req.user.name,
  });
  await doc.save();
  await audit(req, "application.submitted", "application", doc.id);
  res.json(doc);
});
api.post("/applications/:id/assess", analysts, async (req: any, res) => {
  const doc = await application(req.params.id);
  inputSchema.parse(doc.toObject());
  res.status(201).json(await assessApplication(doc, req));
});
api.post("/applications/:id/decision", reviewers, async (req: any, res) => {
  const data = z
    .object({
      decision: z.enum([
        "Under Review",
        "Approved by Reviewer",
        "Rejected by Reviewer",
      ]),
      reason: z.string().trim().min(10).max(2000),
    })
    .parse(req.body);
  const doc = await application(req.params.id);
  if (!["Assessed", "Under Review"].includes(doc.status))
    throw new HttpError(409, "Only assessed applications can be reviewed");
  doc.status = data.decision;
  doc.history.push({
    state: data.decision,
    reason: data.reason,
    actor: req.user.name,
  });
  await doc.save();
  await audit(req, "review.recorded", "application", doc.id, data);
  res.json(doc);
});
api.post("/applications/:id/withdraw", analysts, async (req: any, res) => {
  const doc = await application(req.params.id);
  if (
    ["Approved by Reviewer", "Rejected by Reviewer", "Withdrawn"].includes(
      doc.status,
    )
  )
    throw new HttpError(409, "Final application cannot be withdrawn");
  doc.status = "Withdrawn";
  doc.history.push({
    state: "Withdrawn",
    reason: String(req.body.reason || "Withdrawn by analyst").slice(0, 2000),
    actor: req.user.name,
  });
  await doc.save();
  await audit(req, "application.withdrawn", "application", doc.id);
  res.json(doc);
});
api.get("/assessments", async (req: any, res) =>
  list(
    Assessment,
    req,
    res,
    req.query.applicationId
      ? { applicationId: objectId(req.query.applicationId) }
      : {},
  ),
);
api.get("/analytics", async (req, res) => res.json(await analytics(req.query)));
api.get("/portfolios", async (req, res) =>
  res.json(await analytics(req.query)),
);
api.get("/model", async (_req, res) => res.json(await ml("/model/info")));
api.get("/monitoring", async (_req, res) => {
  const records = await Application.find({ monthlyIncome: { $gt: 0 } })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  const rows = records.flatMap((record) => {
    const parsed = inputSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
  if (rows.length < 20)
    return res.json({
      available: false,
      count: rows.length,
      note: "At least 20 complete applications are needed for a descriptive drift summary. No accuracy is inferred.",
    });
  res.json({ available: true, ...(await ml("/monitor", { rows })) });
});
api.post("/predictions", analysts, async (req: any, res) => {
  const data = inputSchema.parse(req.body);
  const output = await ml("/predict", data);
  await audit(req, "prediction.preview", "model", output.modelVersion);
  res.json(output);
});
api.post("/explanations", async (req, res) => {
  const data = inputSchema.parse(req.body);
  res.json(await ml("/explain", data));
});
api.get("/scenarios", async (req, res) => list(Scenario, req, res));
api.post("/scenarios", analysts, async (req: any, res) => {
  const data = z
    .object({
      name: z.string().trim().min(2).max(120),
      applicationId: z.string().optional(),
      inputs: inputSchema,
      baselineInputs: inputSchema.optional(),
    })
    .parse(req.body);
  let base: any = data.baselineInputs;
  if (data.applicationId)
    base = (await application(data.applicationId)).toObject();
  const result = await ml("/predict", data.inputs);
  const baseline = base ? await ml("/predict", base) : null;
  const scenario = await Scenario.create({
    name: data.name,
    applicationId: data.applicationId,
    inputs: data.inputs,
    result,
    baseline,
    baselineInputs: base ? inputSchema.parse(base) : undefined,
    createdBy: req.user.id,
  });
  await audit(req, "scenario.created", "scenario", scenario.id);
  res.status(201).json(scenario);
});
api.delete("/scenarios/:id", analysts, async (req: any, res) => {
  const doc = await Scenario.findByIdAndDelete(objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Scenario not found");
  await audit(req, "scenario.deleted", "scenario", doc.id);
  res.json({ ok: true });
});
api.use("/batches", batchRouter);
api.get("/alerts", async (req: any, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.severity) filter.severity = String(req.query.severity);
  return list(Alert, req, res, filter);
});
for (const [action, status] of [
  ["acknowledge", "Acknowledged"],
  ["resolve", "Resolved"],
] as const)
  api.post(`/alerts/:id/${action}`, exporters, async (req: any, res) => {
    const doc = await Alert.findById(objectId(req.params.id));
    if (!doc) throw new HttpError(404, "Alert not found");
    if (doc.status === "Resolved")
      throw new HttpError(409, "Alert is already resolved");
    doc.status = status;
    doc.history.push({ action: status, actor: req.user.name, at: new Date() });
    await doc.save();
    await audit(req, `alert.${action}`, "alert", doc.id);
    res.json(doc);
  });
api.get("/audit", async (req: any, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.entityId) filter.entityId = String(req.query.entityId);
  if (req.query.search) {
    const escaped = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["action", "entity", "actorName"].map(field => ({[field]: {$regex: escaped, $options: "i"}}));
  }
  return list(Audit, req, res, filter);
});
api.get("/settings", async (_req, res) => res.json(await policy()));
api.patch("/settings", admins, async (req: any, res) => {
  const data = z
    .object({
      thresholds: z
        .tuple([
          z.number().min(0).max(1),
          z.number().min(0).max(1),
          z.number().min(0).max(1),
        ])
        .refine((t) => t[0] < t[1] && t[1] < t[2], "Thresholds must increase"),
      lgd: z.number().min(0).max(1),
      emiAlertThreshold: z.number().min(0).max(2),
      notifications: z.boolean(),
    })
    .parse(req.body);
  const value = { ...data, version: `policy-${Date.now()}` };
  await Settings.updateOne(
    { key: "riskPolicy" },
    { $set: { value } },
    { upsert: true },
  );
  await audit(req, "settings.updated", "settings", "riskPolicy", value);
  res.json(value);
});
api.get("/users", admins, async (req, res) => list(User, req, res));
api.post("/users", admins, async (req: any, res) => {
  const data = z
    .object({
      name: z.string().min(2).max(120),
      email: z
        .string()
        .email()
        .transform((v) => v.toLowerCase()),
      password: z.string().min(12).max(128),
      role: z.enum(roles),
    })
    .parse(req.body);
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
    role: data.role,
  });
  await audit(req, "user.created", "user", user.id);
  res.status(201).json(user);
});
api.patch("/users/:id", admins, async (req: any, res) => {
  const data = z
    .object({ role: z.enum(roles).optional(), active: z.boolean().optional() })
    .parse(req.body);
  if (
    req.params.id === req.user.id &&
    (data.active === false || (data.role && data.role !== "Administrator"))
  )
    throw new HttpError(409, "Administrators cannot remove their own access");
  const user = await User.findByIdAndUpdate(
    objectId(req.params.id),
    { $set: data, $inc: { tokenVersion: 1 } },
    { new: true, runValidators: true },
  );
  if (!user) throw new HttpError(404, "User not found");
  await audit(req, "user.updated", "user", user.id, data);
  res.json(user);
});
api.post("/copilot", async (req: any, res) => {
  const data = z
    .object({
      question: z.string().trim().min(2).max(2000),
      applicationId: z.string().optional(),
    })
    .parse(req.body);
  let answer: string, sources: string[];
  if (data.applicationId) {
    const doc = await application(data.applicationId);
    await doc.populate("latestAssessment");
    const a: any = doc.latestAssessment;
    if (!a)
      answer = `${doc.applicantId} has no stored assessment. Submit and assess it before requesting model explanations.`;
    else {
      const factors = (a.contributions || [])
        .slice()
        .sort(
          (x: any, y: any) =>
            Math.abs(y.contribution) - Math.abs(x.contribution),
        )
        .slice(0, 3)
        .map(
          (c: any) =>
            `${c.feature} (${c.contribution >= 0 ? "increases" : "decreases"} model output)`,
        )
        .join(", ");
      answer = `Application ${doc.applicantId}: ${a.riskBand} illustrative risk, ${(a.probability * 100).toFixed(1)}% synthetic-outcome estimate using ${a.modelVersion}. Main computed factors: ${factors || "not available"}. Status: ${doc.status}. These are research outputs, not validated lending probabilities or approval recommendations.`;
    }
    sources = [`application:${doc.id}`, "stored assessment"];
  } else if (/emi|ratio|default|loss/i.test(data.question)) {
    answer =
      "EMI is the fixed monthly installment. EMI-to-income = (existing EMI + proposed EMI) / monthly income. Expected loss = illustrative model probability × assumed LGD × requested principal (EAD). These demonstration assumptions are not validated real-world forecasts.";
    sources = ["docs:financial-methodology"];
  } else {
    const a = await analytics();
    answer = `The synthetic portfolio contains ${a.kpis.totalApplications} applications with INR ${a.kpis.totalExposure.toLocaleString("en-IN")} requested exposure; ${a.kpis.assessed} have stored model assessments. ${a.kpis.underReview} are submitted or under review. Illustrative expected loss is INR ${a.kpis.expectedLoss.toFixed(2)} at assumed LGD ${a.assumptions.lgd}. No real banking outcomes are available to validate production accuracy.`;
    sources = ["database:loanApplications", "database:riskAssessments"];
  }
  await audit(req, "copilot.summary", "copilot", data.applicationId);
  res.json({
    answer,
    sources,
    mode: "deterministic",
    note: "No records were sent to an external language model.",
  });
});
api.use("/reports", reportRouter);
app.use((_req, _res, next) => next(new HttpError(404, "Endpoint not found")));
app.use((err: any, req: any, res: any, _next: any) => {
  let status = err.status || 500,
    message = err.message || "Internal server error",
    details = err.details;
  if (err instanceof ZodError) {
    status = 422;
    message = "Validation failed";
    details = err.flatten();
  }
  if (err.code === 11000) {
    status = 409;
    message = "A record with that unique identifier already exists";
  }
  if (err.name === "CastError") {
    status = 400;
    message = "Invalid record identifier";
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    status = 413;
    message = "Upload exceeds the 5 MB limit";
  }
  if (status >= 500)
    logger.error({ requestId: req.id, error: err.message }, "request failed");
  res
    .status(status)
    .json({
      error: {
        message: status === 500 ? "Internal server error" : message,
        details,
        requestId: req.id,
      },
    });
});
export { recoverBatchJobs };
