import "dotenv/config";
import pino from "pino";
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: ["password", "token", "headers.cookie", "headers.authorization"],
});
export const config = {
  port: Number(process.env.PORT || 5000),
  mongo: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/finrisk-ai",
  ml: process.env.ML_SERVICE_URL || "http://127.0.0.1:8000",
  origins: (
    process.env.CORS_ORIGIN || "http://localhost:3001,http://127.0.0.1:3001"
  ).split(","),
  secureCookies:
    process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.NODE_ENV === "production",
  production: process.env.NODE_ENV === "production",
};
export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /replace-with|your_secret/i.test(secret))
    throw new Error("JWT_SECRET must contain at least 32 characters");
  return secret;
}
