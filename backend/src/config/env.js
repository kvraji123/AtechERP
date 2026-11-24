import dotenv from "dotenv";

dotenv.config();

function optionalBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error("AUTH_COOKIE_SECURE must be true or false when it is set.");
}

function optionalHttpUrl(value, variableName) {
  const text = String(value || "").trim();
  if (!text) return "";

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${variableName} must be a complete http(s) URL when it is set.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${variableName} must use http or https.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

// Keep server-side Date operations deterministic; business dates use explicit
// APP_TIME_ZONE helpers and database timestamps are stored/queried in UTC.
process.env.TZ = process.env.SERVER_TIME_ZONE || "UTC";

const required = [
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  auth: {
    mode: String(process.env.AUTH_MODE || "accounts")
      .trim()
      .toLowerCase(),
    sessionHours: Math.min(Math.max(Number(process.env.AUTH_SESSION_HOURS || 8), 1), 24 * 30),
    // HTTPS is the production default. AUTH_COOKIE_SECURE=false is an
    // explicit temporary opt-out for an HTTP-only internal deployment.
    cookieSecure: optionalBoolean(process.env.AUTH_COOKIE_SECURE)
      ?? process.env.NODE_ENV === "production",
    cookieName: String(process.env.AUTH_COOKIE_NAME || "atech_session").trim(),
    initialAdminUsername: String(process.env.INITIAL_ADMIN_USERNAME || "admin").trim(),
    initialAdminName: String(process.env.INITIAL_ADMIN_NAME || "System Administrator").trim(),
    initialAdminPassword: String(process.env.INITIAL_ADMIN_PASSWORD || ""),
    initialStandardUsername: String(process.env.INITIAL_STANDARD_USERNAME || "").trim(),
    initialStandardName: String(process.env.INITIAL_STANDARD_NAME || "").trim(),
    initialStandardPassword: String(process.env.INITIAL_STANDARD_PASSWORD || ""),
  },
  port: Number(process.env.PORT || 4100),
  host: process.env.HOST || "0.0.0.0",
  timeZone: process.env.APP_TIME_ZONE || "Asia/Kolkata",

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    cmsDatabase: process.env.CMS_DB_NAME || "cms_erp",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    timeZone: process.env.DB_TIME_ZONE || "+00:00",
  },

  corsOrigins: String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),

  uploadRoot: process.env.UPLOAD_ROOT || "uploads",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 15),
  onlyOffice: (() => {
    const documentServerUrl = optionalHttpUrl(
      process.env.ONLYOFFICE_DOCUMENT_SERVER_URL,
      "ONLYOFFICE_DOCUMENT_SERVER_URL"
    );
    const publicApiUrl = optionalHttpUrl(
      process.env.ONLYOFFICE_PUBLIC_API_URL,
      "ONLYOFFICE_PUBLIC_API_URL"
    );
    const jwtSecret = String(process.env.ONLYOFFICE_JWT_SECRET || "").trim();
    const requestedSessionMinutes = Number(process.env.ONLYOFFICE_EDITOR_SESSION_MINUTES || 480);
    const sessionMinutes = Number.isFinite(requestedSessionMinutes)
      ? Math.min(Math.max(requestedSessionMinutes, 15), 1440)
      : 480;
    const enabled = Boolean(documentServerUrl && publicApiUrl && jwtSecret);
    return {
      documentServerUrl,
      publicApiUrl,
      jwtSecret,
      sessionMinutes,
      enabled,
      setupMessage: enabled
        ? ""
        : "In-app Tool List editing requires ONLYOFFICE_DOCUMENT_SERVER_URL, ONLYOFFICE_PUBLIC_API_URL and ONLYOFFICE_JWT_SECRET.",
    };
  })(),
  smtp: {
    deliveryEnabled: String(process.env.RFQ_EMAIL_DELIVERY_ENABLED || "false").toLowerCase() === "true",
    host: String(process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    user: String(process.env.SMTP_USERNAME || "").trim(),
    password: String(process.env.SMTP_PASSWORD || ""),
    fromEmail: String(process.env.SMTP_FROM_EMAIL || "").trim(),
    fromName: String(process.env.SMTP_FROM_NAME || "Atech Automation Purchase Team").trim(),
    pollIntervalMs: Math.max(Number(process.env.SMTP_WORKER_INTERVAL_MS || 30000), 5000),
  },
  defaultTenantId: process.env.DEFAULT_TENANT_ID || "DEFAULT",
  defaultCompanyId: process.env.DEFAULT_COMPANY_ID || null,
  userTenantMap: (() => {
    try {
      const parsed = JSON.parse(process.env.USER_TENANT_MAP_JSON || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  })(),
};

if (env.auth.mode !== "accounts") {
  throw new Error("AUTH_MODE must be 'accounts'.");
}
