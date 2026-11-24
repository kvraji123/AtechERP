import mysql from "mysql2/promise";
import { env } from "./env.js";

function createPool(database) {
  return mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database,
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
}

export const db = createPool(env.db.database);
export const cmsDb = createPool(env.db.cmsDatabase);

function configurePool(pool) {
  pool.on("connection", (connection) => {
    connection.query(`SET time_zone = '${env.db.timeZone}'`, (error) => {
      if (error) connection.destroy();
    });
  });
}

configurePool(db);
configurePool(cmsDb);

export async function testDatabaseConnection() {
  const primaryConnection = await db.getConnection();
  let cmsConnection;

  try {
    cmsConnection = await cmsDb.getConnection();
    const [primaryRows, cmsRows] = await Promise.all([
      primaryConnection.query(`
      SELECT 1 AS ok,
        @@global.time_zone AS globalTimeZone,
        @@session.time_zone AS sessionTimeZone,
        @@system_time_zone AS systemTimeZone,
        NOW() AS sessionNow,
        UTC_TIMESTAMP() AS utcNow
      `),
      cmsConnection.query("SELECT 1 AS ok"),
    ]);
    console.log("MySQL time configuration:", primaryRows[0][0]);
    console.log(`CMS marketing database '${env.db.cmsDatabase}' is connected:`, cmsRows[0][0].ok === 1);
  } finally {
    primaryConnection.release();
    cmsConnection?.release();
  }
}

export async function withTransaction(callback) {
  return withPoolTransaction(db, callback);
}

export async function withCmsTransaction(callback) {
  return withPoolTransaction(cmsDb, callback);
}

export async function withPoolTransaction(pool, callback) {
  const connection = await pool.getConnection();

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
