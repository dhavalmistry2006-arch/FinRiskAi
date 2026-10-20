import mongoose, { Schema } from "mongoose";
export const roles = [
  "Administrator",
  "Risk Analyst",
  "Reviewer",
  "Read-Only Viewer",
] as const;
export const states = [
  "Draft",
  "Submitted",
  "Processing",
  "Assessed",
  "Under Review",
  "Approved by Reviewer",
  "Rejected by Reviewer",
  "Withdrawn",
] as const;
const opts = {
  suppressReservedKeysWarning: true,
  timestamps: true as const,
  toJSON: {
    virtuals: true,
    transform: (_doc: any, ret: any) => {
      ret.id = String(ret._id);
      delete ret.__v;
      delete ret.passwordHash;
      return ret;
    },
  },
};
const userSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
  },
  opts,
);
export const User = mongoose.model("User", userSchema);
const applicationSchema = new Schema(
  {
    applicantName: { type: String, required: true, maxlength: 120 },
    applicantId: { type: String, required: true, unique: true },
    age: Number,
    employmentType: String,
    employmentMonths: Number,
    monthlyIncome: Number,
    monthlyExpenses: Number,
    existingDebt: Number,
    existingEmi: Number,
    creditScore: Number,
    loanPurpose: String,
    loanAmount: Number,
    tenureMonths: Number,
    interestRate: Number,
    currency: { type: String, default: "INR" },
    status: { type: String, enum: states, default: "Draft" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    latestAssessment: { type: Schema.Types.ObjectId, ref: "Assessment" },
    synthetic: { type: Boolean, default: true },
    history: [
      {
        state: String,
        reason: String,
        actor: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  opts,
);
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ loanPurpose: 1 });
export const Application = mongoose.model("LoanApplication", applicationSchema);
const assessmentSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "LoanApplication",
      index: true,
      required: true,
    },
    probability: { type: Number, required: true, min: 0, max: 1 },
    riskScore: Number,
    riskBand: String,
    modelVersion: String,
    ratios: Schema.Types.Mixed,
    contributions: [Schema.Types.Mixed],
    warnings: [String],
    reviewPriority: String,
    limitations: Schema.Types.Mixed,
    thresholdVersion: String,
    explanation: Schema.Types.Mixed,
    synthetic: { type: Boolean, default: true },
    raw: Schema.Types.Mixed,
  },
  opts,
);
export const Assessment = mongoose.model("Assessment", assessmentSchema);
export const Scenario = mongoose.model(
  "Scenario",
  new Schema(
    {
      name: { type: String, required: true },
      applicationId: { type: Schema.Types.ObjectId, ref: "LoanApplication" },
      inputs: Schema.Types.Mixed,
      baseline: Schema.Types.Mixed,
      baselineInputs: Schema.Types.Mixed,
      result: Schema.Types.Mixed,
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    opts,
  ),
);
export const Batch = mongoose.model(
  "BatchJob",
  new Schema(
    {
      name: String,
      status: {
        type: String,
        enum: [
          "Queued",
          "Processing",
          "Completed",
          "Completed with errors",
          "Failed",
        ],
        default: "Queued",
      },
      total: Number,
      processed: { type: Number, default: 0 },
      results: [Schema.Types.Mixed],
      errors: [Schema.Types.Mixed],
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    opts,
  ),
);
export const Alert = mongoose.model(
  "Alert",
  new Schema(
    {
      key: { type: String, unique: true },
      severity: String,
      category: String,
      message: String,
      applicationId: { type: Schema.Types.ObjectId, ref: "LoanApplication" },
      jobId: { type: Schema.Types.ObjectId, ref: "BatchJob" },
      status: {
        type: String,
        enum: ["Open", "Acknowledged", "Resolved"],
        default: "Open",
      },
      history: [Schema.Types.Mixed],
    },
    opts,
  ),
);
export const Audit = mongoose.model(
  "AuditLog",
  new Schema(
    {
      actor: { type: Schema.Types.ObjectId, ref: "User" },
      actorName: String,
      action: { type: String, required: true },
      entity: String,
      entityId: String,
      details: Schema.Types.Mixed,
      requestId: String,
    },
    opts,
  ),
);
Audit.schema.index({ createdAt: -1 });
export const Settings = mongoose.model(
  "Settings",
  new Schema(
    { key: { type: String, unique: true }, value: Schema.Types.Mixed },
    opts,
  ),
);
export const Report = mongoose.model(
  "Report",
  new Schema(
    {
      type: String,
      format: String,
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
      entityId: String,
    },
    opts,
  ),
);
export const ModelVersion = mongoose.model(
  "ModelVersion",
  new Schema(
    {
      version: { type: String, unique: true },
      metadata: Schema.Types.Mixed,
      deploymentStatus: { type: String, default: "active" },
    },
    opts,
  ),
);
export async function connect(uri: string) {
  await mongoose.connect(uri);
  await Promise.all([
    User.init(),
    Application.init(),
    Alert.init(),
    Settings.init(),
  ]);
}
