import { db } from "../../config/db.js";

export async function countUsers(connection = db) {
  const [rows] = await connection.execute("SELECT COUNT(*) AS total FROM app_users");
  return Number(rows[0]?.total || 0);
}

export async function createUser(connection, user) {
  const [result] = await connection.execute(
    `INSERT INTO app_users
      (username, display_name, role_name, password_hash, active_flag, must_change_password, created_by)
     VALUES (?, ?, ?, ?, 'Y', ?, ?)`,
    [
      user.username,
      user.displayName,
      user.roleName,
      user.passwordHash,
      user.mustChangePassword ? 1 : 0,
      user.createdBy,
    ]
  );
  return Number(result.insertId);
}

export async function findActiveUserByUsername(username, connection = db) {
  const [rows] = await connection.execute(
    `SELECT user_id, username, display_name, role_name, password_hash, active_flag, must_change_password
       FROM app_users
      WHERE username = ? AND active_flag = 'Y'
      LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

export async function listUsers(connection = db) {
  const [rows] = await connection.execute(
    `SELECT
       user_id AS userId,
       username,
       display_name AS displayName,
       role_name AS roleName,
       active_flag AS activeFlag,
       created_on AS createdOn,
       updated_on AS updatedOn
     FROM app_users
     ORDER BY role_name, display_name, username`
  );
  return rows;
}

export async function createSession(connection, userId, tokenHash, expiresOn) {
  const [result] = await connection.execute(
    `INSERT INTO app_user_sessions (user_id, token_hash, expires_on)
     VALUES (?, ?, ?)`,
    [Number(userId), tokenHash, expiresOn]
  );
  return Number(result.insertId);
}

export async function findActiveSession(tokenHash, connection = db) {
  const [rows] = await connection.execute(
    `SELECT
       S.app_user_session_id AS sessionId,
       U.user_id AS userId,
       U.username,
       U.display_name AS displayName,
       U.role_name AS roleName,
       U.must_change_password AS mustChangePassword
     FROM app_user_sessions S
     JOIN app_users U ON U.user_id = S.user_id
     WHERE S.token_hash = ?
       AND S.revoked_on IS NULL
       AND S.expires_on > UTC_TIMESTAMP()
       AND U.active_flag = 'Y'
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function revokeSession(sessionId, connection = db) {
  await connection.execute(
    `UPDATE app_user_sessions
        SET revoked_on = COALESCE(revoked_on, UTC_TIMESTAMP())
      WHERE app_user_session_id = ?`,
    [Number(sessionId)]
  );
}

export async function revokeExpiredSessions(connection = db) {
  await connection.execute(
    `UPDATE app_user_sessions
        SET revoked_on = UTC_TIMESTAMP()
      WHERE revoked_on IS NULL AND expires_on <= UTC_TIMESTAMP()`
  );
}

export async function updatePassword(connection, userId, passwordHash, updatedBy) {
  await connection.execute(
    `UPDATE app_users
        SET password_hash = ?, must_change_password = 0, updated_by = ?
      WHERE user_id = ?`,
    [passwordHash, updatedBy, Number(userId)]
  );
}

export async function revokeOtherSessions(connection, userId, currentSessionId) {
  await connection.execute(
    `UPDATE app_user_sessions
        SET revoked_on = UTC_TIMESTAMP()
      WHERE user_id = ?
        AND app_user_session_id <> ?
        AND revoked_on IS NULL`,
    [Number(userId), Number(currentSessionId)]
  );
}
