import { Router } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { exporters } from "./auth.js";
import {
  Application,
  Assessment,
  Scenario,
  Batch,
  Audit,
  Report,
} from "./models.js";
import { analytics, ml, audit, HttpError } from "./services.js";
import { safeCsv } from "./validation.js";
export const reportRouter = Router();
reportRouter.use(exporters);
const disclaimer =
  "SYNTHETIC DEMONSTRATION DATA. Research decision support only. Model estimates are not validated probabilities of real borrower default. Human reviewers retain all lending decisions.";
async function data(type: string, id?: string) {
  switch (type) {
    case "applications":
      return (await Application.find().populate("latestAssessment").lean()).map(
        (a: any) => ({
          applicantId: a.applicantId,
          applicantName: a.applicantName,
          loanAmount: a.loanAmount,
          currency: a.currency,
          status: a.status,
          riskBand: a.latestAssessment?.riskBand ?? "Unassessed",
          probability: a.latestAssessment?.probability ?? "",
          modelVersion: a.latestAssessment?.modelVersion ?? "",
        }),
      );
    case "assessment": {
      if (!id)
        throw new HttpError(
          422,
          "Assessment report requires an application id",
        );
      const app = await Application.findById(id).lean();
      if (!app) throw new HttpError(404, "Application not found");
      const assessments = await Assessment.find({ applicationId: id })
        .sort({ createdAt: -1 })
        .lean();
      if (!assessments.length)
        throw new HttpError(409, "Application has no saved assessment");
      return [
        {
          applicantId: app.applicantId,
          applicantName: app.applicantName,
          status: app.status,
          loanAmount: app.loanAmount,
          ...assessments[0],
          _id: undefined,
          raw: undefined,
        },
      ];
    }
    case "portfolio": {
      const a = await analytics();
      return [{ ...a.kpis, ...a.assumptions }];
    }
    case "model":
      return [await ml("/model/info")];
    case "scenarios":
      return await Scenario.find(id ? { _id: id } : {}).lean();
    case "batches":
      return await Batch.find(id ? { _id: id } : {}).lean();
    case "audit":
      return await Audit.find().sort({ createdAt: -1 }).limit(5000).lean();
    default:
      throw new HttpError(404, "Unknown report type");
  }
}
function printable(v: any): string {
  return typeof v === "object" && v !== null
    ? JSON.stringify(v)
    : String(v ?? "");
}
reportRouter.get("/:type", async (req: any, res) => {
  const format = String(req.query.format || "pdf");
  if (!["pdf", "csv", "xlsx"].includes(format))
    throw new HttpError(422, "Report format must be pdf, csv or xlsx");
  const rows: any[] = await data(req.params.type, req.query.id);
  await Report.create({
    type: req.params.type,
    format,
    createdBy: req.user.id,
    entityId: req.query.id,
  });
  await audit(req, "report.exported", "report", req.query.id, {
    type: req.params.type,
    format,
  });
  const filename = `finrisk-${req.params.type}-${new Date().toISOString().slice(0, 10)}.${format}`;
  res.attachment(filename);
  const columns = Array.from(
    new Set(
      rows.flatMap((row) =>
        Object.keys(row).filter(
          (k) => !["_id", "__v", "passwordHash"].includes(k),
        ),
      ),
    ),
  );
  if (format === "csv") {
    res.type("text/csv");
    const quote = (v: any) => `"${safeCsv(printable(v)).replace(/"/g, '""')}"`;
    return res.send(
      [
        columns.map(quote).join(","),
        ...rows.map((row) => columns.map((k) => quote(row[k])).join(",")),
      ].join("\r\n"),
    );
  }
  if (format === "xlsx") {
    const book = new ExcelJS.Workbook();
    book.creator = "FinRisk AI 2.0";
    const sheet = book.addWorksheet("Report");
    sheet.columns = columns.map((key) => ({ header: key, key, width: 24 }));
    for (const row of rows)
      sheet.addRow(
        Object.fromEntries(columns.map((k) => [k, safeCsv(printable(row[k]))])),
      );
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17283F" },
    };
    const notes = book.addWorksheet("Methodology");
    notes.addRow([disclaimer]);
    res.type(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    return res.send(Buffer.from(await book.xlsx.writeBuffer()));
  }
  res.type("application/pdf");
  const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
  doc.pipe(res);
  const navy = "#17283F",
    teal = "#168F7B";
  const heading = (title: string) => {
    if (doc.y > 690) doc.addPage();
    doc
      .moveDown(0.7)
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(navy)
      .text(title)
      .moveDown(0.35);
  };
  const label = (key: string) =>
    key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  const value = (v: any): string => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "number")
      return Number.isInteger(v)
        ? v.toLocaleString("en-IN")
        : v.toLocaleString("en-IN", { maximumFractionDigits: 4 });
    return String(v ?? "Not available");
  };
  const field = (key: string, v: any) => {
    if (doc.y > 720) doc.addPage();
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#627084")
      .text(label(key), 48, doc.y, { width: 170, continued: true });
    doc.fillColor(navy).text(value(v), { width: 490 }).moveDown(0.25);
  };
  doc.rect(0, 0, 595, 118).fill(navy);
  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor("#FFFFFF")
    .text("FinRisk AI", 48, 35);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#A9C6D5")
    .text("INTELLIGENT CREDIT RISK  /  RESEARCH INTELLIGENCE", 48, 68);
  doc
    .fillColor("#FFFFFF")
    .fontSize(11)
    .text(`${label(req.params.type)} report`, 48, 91);
  doc.y = 139;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#627084")
    .text(
      `Generated ${new Date().toISOString()}  |  ${rows.length} stored records`,
    );
  heading("Executive context");
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(navy)
    .text(disclaimer, { lineGap: 3 });
  const pdfRows = rows.slice(0, 100);
  if (rows.length > pdfRows.length)
    doc
      .moveDown()
      .text(
        `PDF includes the first ${pdfRows.length} of ${rows.length} records. Export CSV or XLSX for the complete dataset.`,
      );
  for (let i = 0; i < pdfRows.length; i++) {
    const row = pdfRows[i];
    heading(
      row.applicantName ||
        row.name ||
        (rows.length === 1 ? "Assessment details" : `Record ${i + 1}`),
    );
    const excluded = new Set([
      "_id",
      "__v",
      "raw",
      "features",
      "referenceDistributions",
      "predictionReference",
      "trainingConfig",
      "hyperparameters",
      "comparison",
      "subgroupPerformance",
      "featureImportance",
      "metrics",
      "contributions",
      "ratios",
      "explanation",
      "inputs",
      "baseline",
      "result",
      "results",
      "errors",
      "metadata",
      "background",
      "limitations",
      "history",
      "artifact",
    ]);
    for (const key of Object.keys(row)) {
      if (excluded.has(key) || row[key] === undefined || row[key] === null)
        continue;
      const v = row[key];
      if (typeof v !== "object" || v instanceof Date) field(key, v);
    }
    if (row.probability !== undefined)
      field(
        "illustrativeProbability",
        `${(row.probability * 100).toFixed(2)}% (synthetic target)`,
      );
    if (row.ratios) {
      heading("Financial ratios and repayment");
      for (const [k, v] of Object.entries(row.ratios)) field(k, v);
    }
    if (row.metrics) {
      heading("Held-out synthetic evaluation");
      for (const [k, v] of Object.entries(row.metrics))
        if (typeof v === "number") field(k, v);
    }
    if (row.baseline || row.result) {
      heading("Scenario comparison");
      field(
        "baselineEstimate",
        row.baseline?.probability === undefined
          ? "Not available"
          : `${(row.baseline.probability * 100).toFixed(2)}%`,
      );
      field(
        "modifiedEstimate",
        row.result?.probability === undefined
          ? "Not available"
          : `${(row.result.probability * 100).toFixed(2)}%`,
      );
      if (row.inputs)
        for (const [k, v] of Object.entries(row.inputs))
          if (typeof v !== "object") field(k, v);
    }
    const contributions = row.contributions || row.featureImportance;
    if (contributions?.length) {
      heading(
        row.contributions
          ? "Computed model contributions"
          : "Global feature importance",
      );
      if (row.explanation)
        field(
          "explanationScale",
          `${row.explanation.method}, ${row.explanation.scale}; not causal effects`,
        );
      const factors = contributions.slice(0, 9);
      const max = Math.max(
        ...factors.map((c: any) =>
          Math.abs(c.contribution ?? c.importance ?? 0),
        ),
        0.00001,
      );
      for (const c of factors) {
        if (doc.y > 710) doc.addPage();
        const v = c.contribution ?? c.importance ?? 0;
        const y = doc.y;
        doc
          .fontSize(8)
          .fillColor(navy)
          .text(label(c.feature), 48, y, { width: 180 });
        doc
          .roundedRect(235, y, Math.max(2, (Math.abs(v) / max) * 185), 8, 2)
          .fill(v >= 0 ? teal : "#C97469");
        doc
          .fillColor(navy)
          .text(v.toFixed(4), 440, y, { width: 60, align: "right" });
        doc.y = y + 20;
      }
    }
    if (row.results) field("successfulBatchRows", row.results.length);
    if (row.errors) field("failedBatchRows", row.errors.length);
    if (Array.isArray(row.warnings) && row.warnings.length) {
      heading("Data quality warnings");
      doc.fontSize(9).fillColor(navy).list(row.warnings, { bulletRadius: 2 });
    }
    if (row.modelVersion) field("modelVersion", row.modelVersion);
  }
  heading("Methodology and limitations");
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(navy)
    .text(
      "Expected loss = illustrative synthetic model estimate x assumed loss given default x requested principal. Model contributions explain the trained model and do not establish causation. Research bands are configurable demonstration thresholds. No real-world accuracy, lending eligibility or regulatory endorsement is implied.",
      { lineGap: 3 },
    );
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor("#777777")
      .text(`FinRisk AI · Research demonstration · Page ${i + 1}`, 48, 790, {
        lineBreak: false,
      });
  }
  doc.end();
});
