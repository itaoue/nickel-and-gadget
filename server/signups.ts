/*
 * Log of the site's newsletter signups for the admin (table nag_signups; in memory without DATABASE_URL).
 * BigMailer stays the list of record: this only remembers what the forms sent and whether BigMailer took it.
 */
import { pool } from "./db";

export interface Signup {
  email: string;
  status: "ok" | "error";
  source: string;
  created_at: Date;
}

const memory: Signup[] = [];

const ready = pool
  ?.query(`
    CREATE TABLE IF NOT EXISTS nag_signups (
      id SERIAL PRIMARY KEY,
      email VARCHAR(254) NOT NULL,
      status VARCHAR(10) NOT NULL,
      source VARCHAR(200) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS nag_signups_created ON nag_signups (created_at DESC);
  `)
  .catch((err) => console.error("signups: could not create the nag_signups table", err));

export async function logSignup(email: string, status: Signup["status"], source: string): Promise<void> {
  try {
    if (!pool) {
      memory.unshift({ email, status, source, created_at: new Date() });
      memory.length = Math.min(memory.length, 1000);
      return;
    }
    await ready;
    await pool.query("INSERT INTO nag_signups (email, status, source) VALUES ($1, $2, $3)", [email, status, source.slice(0, 200)]);
  } catch (err) {
    console.error("signups: not logged", err);
  }
}

export async function listSignups(limit = 500): Promise<Signup[]> {
  if (!pool) return memory.slice(0, limit);
  await ready;
  const r = await pool.query("SELECT email, status, source, created_at FROM nag_signups ORDER BY created_at DESC LIMIT $1", [limit]);
  return r.rows;
}

/** Signups BigMailer accepted: all time, last 7 days, today (Pacific). */
export async function signupCounts(): Promise<{ total: number; week: number; today: number }> {
  if (!pool) {
    const ok = memory.filter((s) => s.status === "ok");
    const week = Date.now() - 7 * 86_400_000;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    return {
      total: ok.length,
      week: ok.filter((s) => s.created_at.getTime() > week).length,
      today: ok.filter((s) => s.created_at.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) === today).length,
    };
  }
  await ready;
  const r = await pool.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week,
           count(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Los_Angeles')::date = (now() AT TIME ZONE 'America/Los_Angeles')::date)::int AS today
    FROM nag_signups WHERE status = 'ok'`);
  return r.rows[0];
}
