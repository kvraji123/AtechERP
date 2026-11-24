import { createHmac, timingSafeEqual } from "node:crypto";

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlJsonParse(value) {
  try {
    return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/** Create an HS256 JWT accepted by ONLYOFFICE Document Server. */
export function signOnlyOfficeToken(payload, secret) {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const body = base64UrlJson(payload);
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${signature(unsigned, secret)}`;
}

/**
 * Validate the short-lived URL token used by the Document Server when it
 * fetches a Tool List or reports that it saved one. This is deliberately
 * separate from the ONLYOFFICE config token so a callback cannot be replayed
 * after the editor session expires.
 */
export function verifyOnlyOfficeToken(token, secret) {
  const [encodedHeader, encodedPayload, encodedSignature, ...extra] = String(token || "").split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra.length) return null;

  const header = base64UrlJsonParse(encodedHeader);
  const payload = base64UrlJsonParse(encodedPayload);
  if (!header || header.alg !== "HS256" || !payload || typeof payload !== "object") return null;

  const supplied = Buffer.from(encodedSignature, "base64url");
  const expected = Buffer.from(signature(`${encodedHeader}.${encodedPayload}`, secret), "base64url");
  if (!supplied.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  const expiresAt = Number(payload.exp || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}
