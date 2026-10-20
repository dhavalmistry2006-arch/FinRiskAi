import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const target = ".env";
const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
const keys = new Set(existing.split(/\r?\n/).map((l) => l.split("=")[0]));
const additions = [];
for (const [key, value] of Object.entries({
  JWT_SECRET: randomBytes(48).toString("hex"),
  DEMO_PASSWORD: randomBytes(18).toString("base64url"),
  CORS_ORIGIN: "http://localhost:3001",
  COOKIE_SECURE: "false",
})) {
  if (!keys.has(key)) additions.push(`${key}=${value}`);
}
if (additions.length)
  writeFileSync(
    target,
    `${existing}${existing.endsWith("\n") || !existing ? "" : "\n"}${additions.join("\n")}\n`,
    { mode: 0o600 },
  );
console.log(
  "Local configuration prepared without overwriting existing variables. Credentials are stored only in the ignored .env file; they are never printed.",
);
if (process.argv.includes("--native") && !existsSync("backend/.env")) {
  const root = readFileSync(target, "utf8");
  const configured = new Set(root.split(/\r?\n/).map((l) => l.split("=")[0]));
  const defaults = {
    MONGODB_URI: "mongodb://127.0.0.1:27017/finrisk-ai",
    ML_SERVICE_URL: "http://127.0.0.1:8000",
    NODE_ENV: "development",
    PORT: "5000",
  };
  const missing = Object.entries(defaults)
    .filter(([key]) => !configured.has(key))
    .map(([key, value]) => `${key}=${value}`);
  writeFileSync("backend/.env", root + "\n" + missing.join("\n") + "\n", {
    mode: 0o600,
  });
  console.log("Prepared ignored backend/.env for native development.");
}
