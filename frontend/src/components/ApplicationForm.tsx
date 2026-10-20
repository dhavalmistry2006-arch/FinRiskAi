import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "./ui";
export const applicationSchema = z.object({
  applicantName: z
    .string()
    .trim()
    .min(2, "Enter at least two characters")
    .max(100),
  applicantId: z.string().trim().min(2).max(60),
  age: z.coerce.number().int().min(18).max(100),
  employmentType: z.enum([
    "Salaried",
    "Self-employed",
    "Contract",
    "Unemployed",
    "Retired",
  ]),
  employmentMonths: z.coerce.number().min(0).max(720),
  monthlyIncome: z.coerce
    .number()
    .positive("Income must be greater than zero")
    .max(100000000),
  monthlyExpenses: z.coerce.number().min(0).max(100000000),
  existingDebt: z.coerce.number().min(0).max(1000000000),
  existingEmi: z.coerce.number().min(0).max(100000000),
  creditScore: z.preprocess(
    (v) => (v === "" || v === null || Number.isNaN(v) ? undefined : v),
    z.coerce.number().min(300).max(900).optional(),
  ),
  loanPurpose: z.enum([
    "Personal",
    "Home",
    "Education",
    "Business",
    "Vehicle",
    "Other",
  ]),
  loanAmount: z.coerce.number().positive().max(1000000000),
  tenureMonths: z.coerce.number().int().min(1).max(480),
  interestRate: z.coerce.number().min(0).max(60),
  currency: z.literal("INR"),
});
export type ApplicationInputs = z.infer<typeof applicationSchema>;
export const defaults: ApplicationInputs = {
  applicantName: "",
  applicantId: "",
  age: 30,
  employmentType: "Salaried",
  employmentMonths: 36,
  monthlyIncome: 75000,
  monthlyExpenses: 25000,
  existingDebt: 100000,
  existingEmi: 5000,
  creditScore: 740,
  loanPurpose: "Personal",
  loanAmount: 500000,
  tenureMonths: 36,
  interestRate: 11.5,
  currency: "INR",
};
const fields = [
  ["applicantName", "Applicant name", "text"],
  ["applicantId", "Applicant identifier", "text"],
  ["age", "Age (eligibility only)", "number"],
  ["monthlyIncome", "Monthly income", "number"],
  ["monthlyExpenses", "Monthly expenses", "number"],
  ["existingDebt", "Existing debt balance", "number"],
  ["existingEmi", "Existing monthly EMI", "number"],
  ["creditScore", "Credit score (300–900, optional)", "number"],
  ["employmentMonths", "Employment duration (months)", "number"],
  ["loanAmount", "Requested loan amount", "number"],
  ["tenureMonths", "Loan tenure (months)", "number"],
  ["interestRate", "Annual interest rate (%)", "number"],
] as const;
export function ApplicationForm({
  initial,
  onSubmit,
  busy = false,
  submitText = "Save application",
  compact = false,
}: {
  initial?: Partial<ApplicationInputs>;
  onSubmit: (values: ApplicationInputs) => void;
  busy?: boolean;
  submitText?: string;
  compact?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationInputs>({
    resolver: zodResolver(applicationSchema) as Resolver<ApplicationInputs>,
    defaultValues: { ...defaults, ...initial },
  });
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={`application-form ${compact ? "compact-form" : ""}`}
    >
      <div className="form-section-title">
        Applicant & financial information
        <span>Use synthetic demonstration identities only</span>
      </div>
      <div className="form-grid">
        {fields.map(([name, label, type]) => (
          <label className="field" key={name}>
            <span>{label}</span>
            <input
              aria-invalid={!!errors[name]}
              type={type}
              step={name === "interestRate" ? "0.1" : "1"}
              {...register(name)}
            />
            {errors[name] && (
              <small className="form-error" role="alert">
                {errors[name]?.message}
              </small>
            )}
          </label>
        ))}
        <label className="field">
          <span>Employment type</span>
          <select {...register("employmentType")}>
            {[
              "Salaried",
              "Self-employed",
              "Contract",
              "Unemployed",
              "Retired",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Loan purpose</span>
          <select {...register("loanPurpose")}>
            {[
              "Personal",
              "Home",
              "Education",
              "Business",
              "Vehicle",
              "Other",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Currency</span>
          <select {...register("currency")}>
            {["INR"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-footer">
        <p>
          No real bureau connection. The score uses an illustrative India-style
          300–900 range.
        </p>
        <Button type="submit" disabled={busy}>
          <Save size={15} />
          {busy ? "Saving…" : submitText}
        </Button>
      </div>
    </form>
  );
}
