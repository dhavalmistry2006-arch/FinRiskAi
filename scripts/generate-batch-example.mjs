import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const ExcelJS = require("exceljs");
const records = [
  {
    applicantName: "Synthetic Batch Applicant A",
    applicantId: "SAMPLE-A",
    age: 30,
    monthlyIncome: 90000,
    monthlyExpenses: 28000,
    existingDebt: 100000,
    existingEmi: 5000,
    creditScore: 760,
    loanAmount: 400000,
    tenureMonths: 36,
    interestRate: 11,
    employmentMonths: 60,
    employmentType: "Salaried",
    loanPurpose: "Personal",
    currency: "INR",
  },
  {
    applicantName: "Synthetic Batch Applicant B",
    applicantId: "SAMPLE-B",
    age: 42,
    monthlyIncome: 45000,
    monthlyExpenses: 22000,
    existingDebt: 250000,
    existingEmi: 12000,
    creditScore: 610,
    loanAmount: 700000,
    tenureMonths: 48,
    interestRate: 14,
    employmentMonths: 24,
    employmentType: "Self-employed",
    loanPurpose: "Business",
    currency: "INR",
  },
];
const keys = Object.keys(records[0]);
writeFileSync(
  "datasets/batch-example.csv",
  [keys.join(","), ...records.map((r) => keys.map((k) => r[k]).join(","))].join(
    "\n",
  ) + "\n",
);
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Synthetic applicants");
sheet.columns = keys.map((key) => ({ header: key, key, width: 24 }));
sheet.addRows(records);
await workbook.xlsx.writeFile("datasets/batch-example.xlsx");
console.log("Wrote synthetic CSV and XLSX batch examples.");
