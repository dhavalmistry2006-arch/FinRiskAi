import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { jwtSecret, config } from "./config.js";
import { User } from "./models.js";
import { HttpError } from "./services.js";
export const authenticate: RequestHandler = async (req: any, _res, next) => {
  try {
    const token = req.cookies.finrisk_session;
    if (!token) throw new HttpError(401, "Authentication required");
    let claims: any;
    try {
      claims = jwt.verify(token, jwtSecret(), {
        algorithms: ["HS256"],
        issuer: "finrisk-ai",
        audience: "finrisk-web",
      });
    } catch {
      throw new HttpError(401, "Session expired or invalid");
    }
    const user = await User.findById(claims.sub);
    if (!user || !user.active || user.tokenVersion !== claims.version)
      throw new HttpError(401, "Session expired or user inactive");
    req.user = user.toJSON();
    next();
  } catch (e) {
    next(e);
  }
};
export function allow(...roles: string[]): RequestHandler {
  return (req: any, _res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, "Your role does not permit this action"));
}
export const analysts = allow("Administrator", "Risk Analyst");
export const reviewers = allow("Administrator", "Reviewer");
export const exporters = allow("Administrator", "Risk Analyst", "Reviewer");
export const admins = allow("Administrator");
export const cookieOptions = {
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};
export function issueToken(user: any) {
  return jwt.sign({ version: user.tokenVersion }, jwtSecret(), {
    subject: String(user._id),
    expiresIn: "8h",
    issuer: "finrisk-ai",
    audience: "finrisk-web",
    algorithm: "HS256",
  });
}
