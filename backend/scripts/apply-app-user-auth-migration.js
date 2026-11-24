import { db } from "../src/config/db.js";

const statements = [
  `CREATE TABLE IF NOT EXISTS app_users (
    user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    role_name ENUM('ADMINISTRATOR', 'STANDARD_USER') NOT NULL DEFAULT 'STANDARD_USER',
    password_hash VARCHAR(255) NOT NULL,
    active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
    must_change_password TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50) NULL,
    updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_app_users_username (username),
    KEY ix_app_users_active_role (active_flag, role_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS app_user_sessions (
    app_user_session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_on DATETIME NOT NULL,
    revoked_on DATETIME NULL,
    created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_on DATETIME NULL,
    PRIMARY KEY (app_user_session_id),
    UNIQUE KEY uq_app_user_sessions_token_hash (token_hash),
    KEY ix_app_user_sessions_active (user_id, expires_on, revoked_on),
    CONSTRAINT fk_app_user_sessions_user
      FOREIGN KEY (user_id) REFERENCES app_users (user_id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

try {
  for (const statement of statements) await db.query(statement);
  console.log("Application login tables are ready.");
} finally {
  await db.end();
}
