import { describe, it, expect } from "vitest";
import { financials } from "../src/pages/Intelligence";
import { parseCsv } from "../src/pages/Operations";
import { applicationSchema, defaults } from "../src/components/ApplicationForm";
describe("financial scenario calculations", () => {
  it("handles zero-interest amortization and total repayment", () => {
    const r = financials({
      loanAmount: 120000,
      tenureMonths: 12,
      interestRate: 0,
      monthlyIncome: 50000,
      existingEmi: 5000,
      monthlyExpenses: 20000,
    });
    expect(r.emi).toBe(10000);
    expect(r.totalInterest).toBe(0);
    expect(r.emiToIncome).toBe(0.3);
    expect(r.disposableIncome).toBe(15000);
  });
  it("matches amortization reference and interest total", () => {
    const r = financials({
      loanAmount: 100000,
      tenureMonths: 12,
      interestRate: 12,
      monthlyIncome: 50000,
    });
    expect(r.emi).toBeCloseTo(8884.8789, 3);
    expect(r.totalRepayment).toBeCloseTo(106618.5464, 3);
    expect(r.totalInterest).toBeCloseTo(6618.5464, 3);
  });
});
describe("upload preview", () => {
  it("parses quoted commas escaped quotes CRLF and multiline fields", () => {
    expect(
      parseCsv('name,note\r\n"Demo, A","say ""hello"""\r\nB,"line1\nline2"'),
    ).toEqual([
      ["name", "note"],
      ["Demo, A", 'say "hello"'],
      ["B", "line1\nline2"],
    ]);
  });
});
describe("application validation", () => {
  it("rejects negative income and credit score beyond declared India range", () => {
    const r = applicationSchema.safeParse({
      ...defaults,
      applicantName: "Demo Person",
      applicantId: "TEST-001",
      monthlyIncome: -1,
      creditScore: 901,
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.path[0])).toEqual(
        expect.arrayContaining(["monthlyIncome", "creditScore"]),
      );
  });
  it("accepts missing optional credit score and zero annual interest", () => {
    const r = applicationSchema.safeParse({
      ...defaults,
      applicantName: "Demo Person",
      applicantId: "TEST-002",
      creditScore: "",
      interestRate: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.creditScore).toBeUndefined();
  });
  it("rejects non-INR currency for an INR-trained demonstration model", () => {
    expect(
      applicationSchema.safeParse({
        ...defaults,
        applicantName: "Demo Person",
        applicantId: "TEST-003",
        currency: "USD",
      }).success,
    ).toBe(false);
  });
});
