import { z } from "zod";
export const inputSchema = z.object({
  applicantName: z.string().trim().min(2).max(120),
  applicantId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{2,60}$/),
  age: z.coerce.number().int().min(18).max(100).optional(),
  employmentType: z
    .enum(["Salaried", "Self-employed", "Contract", "Unemployed", "Retired"])
    .default("Salaried"),
  employmentMonths: z.coerce.number().int().min(0).max(720),
  monthlyIncome: z.coerce.number().positive().max(100000000),
  monthlyExpenses: z.coerce.number().min(0).max(100000000),
  existingDebt: z.coerce.number().min(0).max(1000000000),
  existingEmi: z.coerce.number().min(0).max(100000000),
  creditScore: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(300).max(900).optional(),
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
  currency: z.enum(["INR"]).default("INR"),
});
export const draftSchema = inputSchema
  .partial()
  .extend({
    applicantName: inputSchema.shape.applicantName,
    applicantId: inputSchema.shape.applicantId,
  });
export function pagination(query: any) {
  const page = Math.max(1, Number(query.page) || 1),
    limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
export function safeCsv(value: unknown) {
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
