import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { Open } from "unzipper";
import { z } from "zod";
import { analysts, exporters } from "./auth.js";
import { Batch, Alert } from "./models.js";
import { HttpError, audit, ml } from "./services.js";
import { inputSchema, pagination, safeCsv } from "./validation.js";
export const batchRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
  fileFilter(_req, file, cb) {
    const valid = /\.(csv|xlsx)$/i.test(file.originalname);
    cb(
      valid
        ? null
        : (new HttpError(415, "Only CSV and XLSX files are supported") as any),
      valid,
    );
  },
});
const active = new Set<string>();
async function processBatch(id: string, rows: any[], actor: any) {
  if (active.has(id)) return;
  active.add(id);
  try {
    await Batch.updateOne({ _id: id }, { $set: { status: "Processing" } });
    for (let index = 0; index < rows.length; index++) {
      const parsed = inputSchema.safeParse(rows[index]);
      if (!parsed.success) {
        await Batch.updateOne(
          { _id: id },
          {
            $push: {
              errors: {
                row: index + 2,
                message: "Validation failed",
                issues: parsed.error.flatten(),
              },
            },
            $inc: { processed: 1 },
          },
        );
        continue;
      }
      try {
        const result = await ml("/predict", parsed.data);
        await Batch.updateOne(
          { _id: id },
          {
            $push: {
              results: { row: index + 2, inputs: parsed.data, ...result },
            },
            $inc: { processed: 1 },
          },
        );
      } catch (error: any) {
        await Batch.updateOne(
          { _id: id },
          {
            $push: { errors: { row: index + 2, message: error.message } },
            $inc: { processed: 1 },
          },
        );
      }
    }
    const job = await Batch.findById(id);
    if (!job) return;
    job.status = job.errors.length ? "Completed with errors" : "Completed";
    await job.save();
    if (job.errors.length)
      await Alert.updateOne(
        { key: `batch:${id}` },
        {
          $set: {
            severity: "Medium",
            category: "Batch",
            message: `${job.errors.length} rows failed in ${job.name}`,
            jobId: job._id,
            status: "Open",
          },
        },
        { upsert: true },
      );
    await audit(
      { user: actor, id: `job-${id}` },
      "batch.completed",
      "batch",
      id,
      { processed: job.processed, errors: job.errors.length },
    );
  } catch (error: any) {
    await Batch.updateOne(
      { _id: id },
      {
        $set: { status: "Failed" },
        $push: { errors: { message: error.message } },
      },
    );
  } finally {
    active.delete(id);
  }
}
export async function recoverBatchJobs() {
  await Batch.updateMany(
    { status: { $in: ["Queued", "Processing"] } },
    {
      $set: { status: "Failed" },
      $push: {
        errors: {
          message:
            "Server restarted before processing completed. Completed rows are retained; upload remaining rows to retry.",
        },
      },
    },
  );
}
batchRouter.get("/", async (req: any, res) => {
  const { page, limit, skip } = pagination(req.query);
  const [items, total] = await Promise.all([
    Batch.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Batch.countDocuments(),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
async function parseUpload(file: Express.Multer.File): Promise<any[]> {
  let rows: any[];
  if (/\.xlsx$/i.test(file.originalname)) {
    let archive;
    try {
      archive = await Open.buffer(file.buffer);
    } catch {
      throw new HttpError(422, "Invalid XLSX archive");
    }
    if (
      archive.files.length > 200 ||
      archive.files.some((f) => f.uncompressedSize > 10000000) ||
      archive.files.reduce((sum, f) => sum + f.uncompressedSize, 0) > 25000000
    )
      throw new HttpError(413, "XLSX expanded content exceeds safe limits");
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(Uint8Array.from(file.buffer).buffer);
    } catch {
      throw new HttpError(422, "Invalid XLSX workbook");
    }
    if (workbook.worksheets.length !== 1)
      throw new HttpError(
        422,
        "Upload a workbook containing exactly one sheet",
      );
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount > 501 || sheet.columnCount > 40)
      throw new HttpError(422, "Batch limit is 500 rows and 40 columns");
    const header = (sheet.getRow(1).values as any[]).slice(1).map(String);
    if (new Set(header).size !== header.length)
      throw new HttpError(422, "Duplicate column names are not supported");
    rows = [];
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      const record: any = {};
      header.forEach((key, j) => {
        const value = row.getCell(j + 1).value;
        if (value && typeof value === "object")
          throw new HttpError(
            422,
            "Formula, hyperlink and rich-text cells are not supported",
          );
        record[key] = value ?? "";
      });
      rows.push(record);
    });
  } else {
    try {
      rows = parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        max_record_size: 20000,
        trim: true,
      });
    } catch {
      throw new HttpError(
        422,
        "CSV parsing failed. Check column headers and delimiters.",
      );
    }
  }
  if (!rows.length || rows.length > 500)
    throw new HttpError(422, "Upload between 1 and 500 records");

  const headers = Object.keys(rows[0]);
  if (
    headers.length > 40 ||
    headers.some((h) => ["__proto__", "constructor", "prototype"].includes(h))
  )
    throw new HttpError(422, "Unsafe or excessive input columns");
  return rows;
}
batchRouter.post(
  "/preview",
  analysts,
  upload.single("file"),
  async (req: any, res) => {
    if (!req.file)
      throw new HttpError(
        422,
        "Upload a CSV or XLSX file using the file field",
      );
    const records = await parseUpload(req.file);
    const headers = Object.keys(records[0]);
    const errors = records.flatMap((row, index) => {
      const parsed = inputSchema.safeParse(row);
      return parsed.success
        ? []
        : [
            {
              row: index + 2,
              message: "Input schema validation failed before column mapping",
              issues: parsed.error.flatten(),
            },
          ];
    });
    res.json({
      headers,
      rows: records
        .slice(0, 5)
        .map((row) => headers.map((h) => String(row[h] ?? ""))),
      total: records.length,
      errors,
    });
  },
);
batchRouter.post(
  "/",
  analysts,
  upload.single("file"),
  async (req: any, res) => {
    if (!req.file)
      throw new HttpError(
        422,
        "Upload a CSV or XLSX file using the file field",
      );
    let rows = await parseUpload(req.file);
    if (req.body.mapping) {
      let mapping: Record<string, string>;
      try {
        mapping = z.record(z.string()).parse(JSON.parse(req.body.mapping));
      } catch {
        throw new HttpError(
          422,
          "Column mapping must be a JSON object of destination field to source column",
        );
      }
      rows = rows.map((row) =>
        Object.fromEntries(
          Object.entries(mapping).map(([destination, source]) => [
            destination,
            row[source],
          ]),
        ),
      );
    }
    const job = await Batch.create({
      name: req.file.originalname.slice(0, 120),
      total: rows.length,
      createdBy: req.user.id,
    });
    await audit(req, "batch.created", "batch", job.id, { rows: rows.length });
    res.status(202).json(job);
    setImmediate(() => void processBatch(job.id, rows, req.user));
  },
);
batchRouter.get("/:id", async (req, res) => {
  const doc = await Batch.findById(req.params.id);
  if (!doc) throw new HttpError(404, "Batch not found");
  res.json(doc);
});
batchRouter.get("/:id/download", exporters, async (req: any, res) => {
  const job = await Batch.findById(req.params.id);
  if (!job) throw new HttpError(404, "Batch not found");
  const rows = job.results.map((r: any) => ({
    row: r.row,
    applicantId: r.inputs?.applicantId,
    probability: r.probability,
    riskScore: r.riskScore,
    riskBand: r.riskBand,
    modelVersion: r.modelVersion,
  }));
  await audit(req, "batch.exported", "batch", job.id);
  const columns = [
    "row",
    "applicantId",
    "probability",
    "riskScore",
    "riskBand",
    "modelVersion",
  ];
  const quote = (v: unknown) => '"' + safeCsv(v).replace(/"/g, '""') + '"';
  res
    .attachment(`batch-${job.id}.csv`)
    .type("text/csv")
    .send(
      [
        columns.join(","),
        ...rows.map((row: any) =>
          columns.map((key) => quote(row[key])).join(","),
        ),
      ].join("\r\n"),
    );
});
