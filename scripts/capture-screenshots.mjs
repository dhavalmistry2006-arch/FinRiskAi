import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
const source = readFileSync("backend/.env", "utf8");
const password =
  process.env.DEMO_PASSWORD ||
  source
    .split(/\r?\n/)
    .find((l) => l.startsWith("DEMO_PASSWORD="))
    .slice(14);
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const login = await context.request.post(
    "http://localhost:3001/api/v1/auth/login",
    { data: { email: "admin@finrisk.demo", password } },
  );
  if (!login.ok()) throw new Error(`Login failed ${login.status()}`);
  const page = await context.newPage();
  mkdirSync("docs/screenshots", { recursive: true });
  for (const [path, title, name] of [
    ["/", "Command Center", "command-center"],
    ["/applications", "Loan Applications", "applications"],
    ["/scenarios", "Scenario Simulator", "scenario-simulator"],
    ["/models", "Model Intelligence", "model-intelligence"],
  ]) {
    await page.goto(`http://localhost:3001${path}`);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    await page
      .locator(".loading-skeleton,.skeleton")
      .first()
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {});
    await page.screenshot({
      path: `docs/screenshots/${name}.png`,
      animations: "disabled",
    });
  }
  await page.goto("http://localhost:3001/");
  await page.getByText("Total applications", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Use dark mode" }).click();
  await page.screenshot({
    path: "docs/screenshots/command-center-dark.png",
    animations: "disabled",
  });
  console.log("Captured five screenshots of the connected application.");
} finally {
  await browser.close();
}
