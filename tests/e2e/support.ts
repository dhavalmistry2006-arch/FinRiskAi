import { readFileSync, existsSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";
export function demoPassword() {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  for (const file of ["backend/.env", ".env"]) {
    if (existsSync(file)) {
      const line = readFileSync(file, "utf8")
        .split(/\r?\n/)
        .find((l) => l.startsWith("DEMO_PASSWORD="));
      if (line)
        return line.slice("DEMO_PASSWORD=".length).replace(/^['"]|['"]$/g, "");
    }
  }
  throw new Error("Set DEMO_PASSWORD for seeded test accounts");
}
export async function login(
  request: APIRequestContext,
  email = "admin@finrisk.demo",
) {
  const response = await request.post("/api/v1/auth/login", {
    data: { email, password: demoPassword() },
  });
  if (!response.ok()) throw new Error(`Login failed ${response.status()}`);
  return (await response.json()).user;
}
export async function browserLogin(page: Page, email = "admin@finrisk.demo") {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(demoPassword());
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
}
export const financialInput = {
  applicantName: "Synthetic Workflow Tester",
  applicantId: "E2E-SCENARIO",
  age: 32,
  monthlyIncome: 85000,
  monthlyExpenses: 26000,
  existingDebt: 150000,
  existingEmi: 6000,
  creditScore: 742,
  loanAmount: 450000,
  tenureMonths: 36,
  interestRate: 11.5,
  employmentMonths: 60,
  employmentType: "Salaried",
  loanPurpose: "Personal",
  currency: "INR",
};
