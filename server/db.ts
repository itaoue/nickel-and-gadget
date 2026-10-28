/*
 * One Postgres pool for the server (poll votes, signup log, admin), or null without DATABASE_URL.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
export const pool = url
  ? new pg.Pool({ connectionString: url, max: 5, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined })
  : null;
