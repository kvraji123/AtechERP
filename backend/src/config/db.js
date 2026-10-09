import mysql from "mysql2/promise";
import { env } from "./env.js";

export const db = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  // Persist and return DATETIME/TIMESTAMP values as timezone-neutral strings;
  // all CURRENT_TIMESTAMP expressions run in UTC for pooled sessions.
  timezone: env.db.timeZone,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  decimalNumbers: true,
  namedPlaceholders: true,
  dateStrings: ["DATE", "DATETIME", "TIMESTAMP"],
  typeCast(field, next) {
    if (["DATE", "DATETIME", "TIMESTAMP"].includes(field.type)) {
      return field.string();
    }
    return next();
  },
});

db.on("connection", (connection) => {
  connection.query(`SET time_zone = '${env.db.timeZone}'`, (error) => {
    if (error) connection.destroy();
  });
});

export async function testDatabaseConnection() {
  const connection = await db.getConnection();

  try {
    const [rows] = await connection.query(`
      SELECT 1 AS ok,
        @@global.time_zone AS globalTimeZone,
        @@session.time_zone AS sessionTimeZone,
        @@system_time_zone AS systemTimeZone,
        NOW() AS sessionNow,
        UTC_TIMESTAMP() AS utcNow
    `);
    console.log("MySQL time configuration:", rows[0]);
  } finally {
    connection.release();
  }
}

export async function withTransaction(callback) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
