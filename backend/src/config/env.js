import dotenv from "dotenv";

dotenv.config();

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
  port: Number(process.env.PORT || 4100),
  host: process.env.HOST || "0.0.0.0",
  timeZone: process.env.APP_TIME_ZONE || "Asia/Kolkata",

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    timeZone: process.env.DB_TIME_ZONE || "+00:00",
  },

  corsOrigins: String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),

  uploadRoot: process.env.UPLOAD_ROOT || "uploads",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 15),
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
