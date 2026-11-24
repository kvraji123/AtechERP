import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { withTransaction } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./auth.repository.js";

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;
const passwordMinimumLength = 12;
const standardPermissions = ["EDIT_ENQUIRY_ALL_STAGES"];
const administratorPermissions = [
  ...standardPermissions,
  "CLOSE_FEASIBILITY",
  "GENERATE_REGRET_LETTER",
  "APPROVE_REGRET_LETTER",
  "SEND_REGRET_LETTER",
  "COMPLETE_WORKOUT",
  "CREATE_QUOTATION",
  "FINALIZE_QUOTATION",
  "GENERATE_QUOTATION_PDF",
  "SEND_QUOTATION_EMAIL",
  "PR_CREATE",
  "PR_SUBMIT",
  "PR_APPROVE",
  "RFQ_CREATE",
  "QUOTE_ENTER",
  "SUPPLIER_SELECT",
  "PO_CREATE",
  "PO_APPROVE",
  "GRN_POST",
  "REPORT_VIEW",
];

function clean(value) {
  return String(value || "").trim();
}

function normalizeUsername(value) {
  const username = clean(value).toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw new AppError("Username must contain 3 to 50 letters, numbers, dots, underscores, or hyphens.");
  }
  return username;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < passwordMinimumLength || password.length > 256) {
    throw new AppError(`Password must contain ${passwordMinimumLength} to 256 characters.`);
  }
  return password;
}

function roleLabel(roleName) {
  return roleName === "ADMINISTRATOR" ? "Administrator" : "Standard User";
}

function normalizeRole(value) {
  const role = clean(value).toUpperCase().replace(/\s+/g, "_");
  if (!["ADMINISTRATOR", "STANDARD_USER"].includes(role)) {
    throw new AppError("Role must be Administrator or Standard User.");
  }
  return role;
}

function validateDisplayName(value) {
  const displayName = clean(value);
  if (displayName.length < 2 || displayName.length > 150) {
    throw new AppError("Display name must contain 2 to 150 characters.");
  }
  return displayName;
}

function toIdentity(row) {
  const username = row.username;
  const roleName = row.roleName ?? row.role_name;
  return {
    userId: Number(row.userId ?? row.user_id),
    userCode: username,
    employeeName: row.displayName ?? row.display_name,
    role: roleLabel(roleName),
    permissions: roleName === "ADMINISTRATOR" ? administratorPermissions : standardPermissions,
    mustChangePassword: Boolean(row.mustChangePassword ?? row.must_change_password),
    tenantId: String(env.userTenantMap[username] || env.defaultTenantId),
    companyId: env.defaultCompanyId,
  };
}

async function passwordHash(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, passwordKeyLength);
  return `scrypt$${salt}$${Buffer.from(derived).toString("base64url")}`;
}

async function passwordMatches(password, storedHash) {
  const [algorithm, salt, expected] = String(storedHash || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const expectedBuffer = Buffer.from(expected, "base64url");
  const derived = Buffer.from(await scrypt(password, salt, passwordKeyLength));
  return expectedBuffer.length === derived.length && timingSafeEqual(expectedBuffer, derived);
}

function sessionTokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiresOn() {
  return new Date(Date.now() + env.auth.sessionHours * 60 * 60 * 1000);
}

export async function bootstrapInitialAccounts() {
  const users = await repository.countUsers();
  if (users > 0) return;

  const adminUsername = normalizeUsername(env.auth.initialAdminUsername);
  const adminPassword = validatePassword(env.auth.initialAdminPassword);
  const hasStandardUsername = Boolean(env.auth.initialStandardUsername);
  const hasStandardPassword = Boolean(env.auth.initialStandardPassword);
  if (hasStandardUsername !== hasStandardPassword) {
    throw new Error("Set both INITIAL_STANDARD_USERNAME and INITIAL_STANDARD_PASSWORD, or leave both empty.");
  }

  const adminPasswordHash = await passwordHash(adminPassword);
  const standardPasswordHash = hasStandardPassword
    ? await passwordHash(validatePassword(env.auth.initialStandardPassword))
    : null;

  await withTransaction(async (connection) => {
    await repository.createUser(connection, {
      username: adminUsername,
      displayName: clean(env.auth.initialAdminName) || "System Administrator",
      roleName: "ADMINISTRATOR",
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
      createdBy: "SYSTEM",
    });

    if (standardPasswordHash) {
      await repository.createUser(connection, {
        username: normalizeUsername(env.auth.initialStandardUsername),
        displayName: clean(env.auth.initialStandardName) || env.auth.initialStandardUsername,
        roleName: "STANDARD_USER",
        passwordHash: standardPasswordHash,
        mustChangePassword: false,
        createdBy: "SYSTEM",
      });
    }
  });
}

export async function signIn(usernameValue, passwordValue) {
  const username = normalizeUsername(usernameValue);
  const password = String(passwordValue || "");
  const account = await repository.findActiveUserByUsername(username);
  if (!account || !(await passwordMatches(password, account.password_hash))) {
    throw new AppError("Invalid username or password.", 401);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresOn = sessionExpiresOn();
  const sessionId = await withTransaction((connection) => repository.createSession(
    connection,
    account.user_id,
    sessionTokenHash(token),
    expiresOn
  ));

  return {
    token,
    sessionId,
    expiresOn,
    user: toIdentity(account),
  };
}

export async function listUserAccounts() {
  const users = await repository.listUsers();
  return users.map((user) => ({
    userId: Number(user.userId),
    username: user.username,
    displayName: user.displayName,
    role: roleLabel(user.roleName),
    active: user.activeFlag === "Y",
    createdOn: user.createdOn,
    updatedOn: user.updatedOn,
  }));
}

export async function createUserAccount(data, createdBy) {
  const username = normalizeUsername(data?.username);
  const displayName = validateDisplayName(data?.displayName);
  const roleName = normalizeRole(data?.role);
  const hashedPassword = await passwordHash(validatePassword(data?.password));

  try {
    const userId = await withTransaction((connection) => repository.createUser(connection, {
      username,
      displayName,
      roleName,
      passwordHash: hashedPassword,
      mustChangePassword: false,
      createdBy,
    }));
    return { userId, username, displayName, role: roleLabel(roleName), active: true };
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw new AppError("That username is already in use.", 409);
    }
    throw error;
  }
}

export async function getAuthenticatedSession(token) {
  if (!token || token.length < 32) return null;
  const session = await repository.findActiveSession(sessionTokenHash(token));
  if (!session) return null;
  return { sessionId: Number(session.sessionId), user: toIdentity(session) };
}

export async function signOut(sessionId) {
  if (sessionId) await repository.revokeSession(sessionId);
}

export async function changePassword(user, sessionId, currentPasswordValue, nextPasswordValue) {
  const account = await repository.findActiveUserByUsername(user.userCode);
  if (!account || !(await passwordMatches(String(currentPasswordValue || ""), account.password_hash))) {
    throw new AppError("Current password is incorrect.", 401);
  }

  const nextPasswordHash = await passwordHash(validatePassword(nextPasswordValue));
  await withTransaction(async (connection) => {
    await repository.updatePassword(connection, account.user_id, nextPasswordHash, user.userCode);
    await repository.revokeOtherSessions(connection, account.user_id, sessionId);
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: env.auth.sessionHours * 60 * 60 * 1000,
  };
}

export function clearCookieOptions() {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  return options;
}
