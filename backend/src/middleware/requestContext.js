import { env } from "../config/env.js"
import { AppError } from "../utils/AppError.js";
import { getAuthenticatedSession } from "../modules/auth/auth.service.js";

function readCookie(req, cookieName) {
  const cookieHeader = String(req.headers.cookie || "");
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    if (name !== cookieName) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

export function sessionTokenFromRequest(req) {
  return readCookie(req, "atech_session");
}

export async function requestContext(req, _res, next) {
  if (req.method === "OPTIONS" || (req.path === "/health" && req.method === "GET")) {
    return next();
  }

  if (req.path === "/api/v1/auth/login" && req.method === "POST") {
    return next();
  }

  // ONLYOFFICE Document Server cannot supply the application's browser
  // session cookie. These two endpoints independently validate a signed,
  // short-lived editor-session token before exposing or replacing a file.
  if (/^\/api\/v1\/parts\/process-definitions\/\d+\/tool-list\/editor-(file|callback)$/.test(req.path)) {
    return next();
  }

  try {
    const session = await getAuthenticatedSession(sessionTokenFromRequest(req));
    if (!session) throw new AppError("Sign in is required.", 401);

    req.user = session.user;
    req.authSessionId = session.sessionId;
    return next();
  } catch (error) {
    return next(error);
  }
}
