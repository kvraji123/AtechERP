import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/response.js";
import * as service from "./auth.service.js";

export async function login(req, res) {
  const result = await service.signIn(req.body?.username, req.body?.password);
  res.cookie("atech_session", result.token, service.cookieOptions());
  return sendSuccess(res, {
    message: "Signed in successfully.",
    data: result.user,
  });
}

export async function me(req, res) {
  return sendSuccess(res, { data: req.user });
}

export async function logout(req, res) {
  await service.signOut(req.authSessionId);
  res.clearCookie("atech_session", service.clearCookieOptions());
  return sendSuccess(res, { message: "Signed out successfully." });
}

export async function changePassword(req, res) {
  await service.changePassword(
    req.user,
    req.authSessionId,
    req.body?.currentPassword,
    req.body?.newPassword
  );
  return sendSuccess(res, { message: "Password updated successfully." });
}

export async function listUsers(_req, res) {
  return sendSuccess(res, { data: await service.listUserAccounts() });
}

export async function createUser(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "User account created successfully.",
    data: await service.createUserAccount(req.body, req.user.userCode),
  });
}
