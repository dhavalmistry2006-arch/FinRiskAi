import { test, expect } from "@playwright/test";
import { browserLogin } from "./support";

test("login and every principal navigation route renders real connected content", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await browserLogin(page);
  await expect(
    page.getByRole("heading", { name: "Command Center", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Total applications", { exact: true }),
  ).toBeVisible();
  const routes = [
    ["Loan Applications", "Loan Applications"],
    ["AI Risk Assessment", "AI Risk Assessment"],
    ["Explainable AI", "Explainable AI"],
    ["Portfolio Analytics", "Portfolio Analytics"],
    ["Scenario Simulator", "Scenario Simulator"],
    ["Batch Risk Analysis", "Batch Risk Analysis"],
    ["Model Intelligence", "Model Intelligence"],
    ["Risk Alerts", "Risk Alerts"],
    ["Reports & Exports", "Reports & Exports"],
    ["Audit Trail", "Audit Trail"],
    ["Administration", "Administration"],
  ];
  for (const [label, title] of routes) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator("main.content")).not.toContainText(
      "Something went wrong",
    );
  }
  expect(errors).toEqual([]);
});

test("theme and laptop/mobile layouts remain usable without page overflow", async ({
  page,
}) => {
  await browserLogin(page);
  await page.getByRole("button", { name: "Use dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Use light mode" }).click();
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 2,
      ),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Loan Applications", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Loan Applications", exact: true }),
  ).toBeVisible();
});

test("analyst creates a draft, submits, assesses, explains and downloads a stored assessment", async ({
  page,
}) => {
  await browserLogin(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Loan Applications", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New application", exact: true })
    .click();
  await page
    .getByLabel("Applicant name", { exact: true })
    .fill("Synthetic Browser Applicant");
  await page
    .getByLabel("Applicant identifier", { exact: true })
    .fill(`BROWSER-${Date.now()}`);
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic Browser Applicant",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run assessment", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Run assessment", exact: true })
    .click();
  await expect(
    page.getByText("Key contributing features", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("main.content")).toContainText(
    "synthetic-credit-v1.0.0",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Assessment PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Explainable AI", exact: true })
    .click();
  const select = page.getByRole("combobox", {
    name: "Application",
    exact: true,
  });
  const option = select
    .locator("option")
    .filter({ hasText: "Synthetic Browser Applicant" })
    .first();
  const selected = await option.getAttribute("value");
  await select.selectOption(selected!);
  await expect(
    page.getByText("Understanding the explanation", { exact: true }),
  ).toBeVisible();
});

test("scenario sliders save a real baseline comparison and CSV preview processes a batch", async ({
  page,
}) => {
  await browserLogin(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Scenario Simulator", exact: true })
    .click();
  const name = `Browser scenario ${Date.now()}`;
  await page
    .getByRole("slider", { name: "Monthly income", exact: true })
    .focus();
  await page
    .getByRole("slider", { name: "Monthly income", exact: true })
    .press("ArrowRight");
  await page
    .getByRole("textbox", { name: "Scenario name", exact: true })
    .fill(name);
  await page
    .getByRole("button", { name: "Compare & save", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Model comparison", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Batch Risk Analysis", exact: true })
    .click();
  await page
    .getByLabel("Upload batch file")
    .setInputFiles("datasets/batch-example.csv");
  await expect(
    page.getByRole("heading", { name: "Column mapping", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Validate & analyze dataset", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download assessments", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const download = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download assessments", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});
