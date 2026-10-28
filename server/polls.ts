/*
 * Reader polls for the daily newsletter.
 *
 * The question and options are static files written by tools/build_newsletter.py
 * (client/public/polls/<campaign>.json, deployed with the site), so no write API or token is needed.
 * Votes live in Postgres (DATABASE_URL, Railway's Postgres plugin), table nag_poll_votes (named apart from
 * Ascend's aw_poll_votes and Upwellness Insider's poll_votes so the sites can share one database). Without DATABASE_URL votes are
 * kept in memory, which is fine for local testing but is lost on every deploy.
 *
 *   GET /poll/:campaign/vote/:choice?c=<BigMailer contact id>  -> records the vote, redirects to the results page
 *   GET /api/polls/:campaign                                     -> question, options, counts (for the React page)
 *
 * One vote per subscriber when the email link carries ?c=*|_ID|* (last click wins, so link scanners that
 * pre-open every option cannot lock in a choice); otherwise one vote per browser cookie / ip+UA hash.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Express, Request } from "express";
import type pg from "pg";
import { pool as dbPool } from "./db";

const CAMPAIGN_RE = /^\d{4}-\d{2}-\d{2}(-[a-z]+)?$/; // NAG issues are plain dates, e.g. 2026-10-28
const CONTACT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BOT_UA = /bot|crawl|spider|slurp|preview|scan|proofpoint|mimecast|barracuda|safelinks|python|curl|wget|httpclient|okhttp|headless|phantom|monitor|checker|fetch/i;
const COOKIE_DAYS = 90;

interface Poll {
  campaign: string;
  question: string;
  options: string[];
}
interface Vote {
  campaign: string;
  choice: number;
  voter: string;
  contact: string;
}

export interface Store {
  kind: "postgres" | "memory";
  vote(v: Vote): Promise<void>;
  counts(campaign: string): Promise<Map<number, number>>;
  /** Total votes stored; throws if the database cannot be reached. */
  total(): Promise<number>;
}

function memoryStore(): Store {
  const votes: Vote[] = [];
  return {
    kind: "memory",
    async total() {
      return votes.length;
    },
    async vote(v) {
      const prior = votes.find(
        (x) => x.campaign === v.campaign && (v.contact ? x.contact === v.contact : x.voter === v.voter),
      );
      if (prior && v.contact) prior.choice = v.choice;
      else if (!prior) votes.push(v);
    },
    async counts(campaign) {
      const m = new Map<number, number>();
      for (const v of votes) if (v.campaign === campaign) m.set(v.choice, (m.get(v.choice) ?? 0) + 1);
      return m;
    },
  };
}

function pgStore(pool: pg.Pool): Store {
  const ready = pool.query(`
    CREATE TABLE IF NOT EXISTS nag_poll_votes (
      id SERIAL PRIMARY KEY,
      campaign VARCHAR(40) NOT NULL,
      choice SMALLINT NOT NULL,
      voter VARCHAR(64) NOT NULL DEFAULT '',
      contact_id VARCHAR(36) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS nag_poll_votes_contact ON nag_poll_votes (campaign, contact_id) WHERE contact_id <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS nag_poll_votes_voter ON nag_poll_votes (campaign, voter) WHERE contact_id = '';
  `);
  ready.catch((err) => console.error("polls: could not create the nag_poll_votes table", err));
  return {
    kind: "postgres",
    async total() {
      await ready;
      const r = await pool.query("SELECT count(*)::int AS n FROM nag_poll_votes");
      return Number(r.rows[0].n);
    },
    async vote(v) {
      await ready;
      if (v.contact) {
        await pool.query(
          `INSERT INTO nag_poll_votes (campaign, choice, voter, contact_id) VALUES ($1, $2, $3, $4)
           ON CONFLICT (campaign, contact_id) WHERE contact_id <> '' DO UPDATE SET choice = EXCLUDED.choice, updated_at = now()`,
          [v.campaign, v.choice, v.voter, v.contact],
        );
      } else {
        await pool.query(
          `INSERT INTO nag_poll_votes (campaign, choice, voter) VALUES ($1, $2, $3)
           ON CONFLICT (campaign, voter) WHERE contact_id = '' DO NOTHING`,
          [v.campaign, v.choice, v.voter],
        );
      }
    },
    async counts(campaign) {
      await ready;
      const r = await pool.query("SELECT choice, count(*)::int AS n FROM nag_poll_votes WHERE campaign = $1 GROUP BY choice", [campaign]);
      return new Map(r.rows.map((row) => [Number(row.choice), Number(row.n)]));
    },
  };
}

function cookie(req: Request, name: string): string {
  const m = (req.headers.cookie ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function voterId(req: Request): string {
  const ip = String(req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
  return crypto.createHash("sha256").update(`${ip}|${req.headers["user-agent"] ?? ""}`).digest("hex").slice(0, 40);
}

export function registerPolls(app: Express, staticPath: string): Store {
  const store = dbPool ? pgStore(dbPool) : memoryStore();
  if (!dbPool) console.warn("polls: DATABASE_URL is not set; votes are kept in memory and lost on restart");

  const loadPoll = (campaign: string): Poll | null => {
    if (!CAMPAIGN_RE.test(campaign)) return null;
    try {
      const p = JSON.parse(fs.readFileSync(path.join(staticPath, "polls", `${campaign}.json`), "utf8"));
      return Array.isArray(p.options) && p.question ? (p as Poll) : null;
    } catch {
      return null;
    }
  };

  app.get("/poll/:campaign/vote/:choice", async (req, res) => {
    const poll = loadPoll(req.params.campaign);
    const choice = Number(req.params.choice);
    if (!poll || !Number.isInteger(choice) || choice < 0 || choice >= poll.options.length) return res.status(404).send("Poll not found");
    const ua = String(req.headers["user-agent"] ?? "");
    const contact = String(req.query.c ?? "").trim().toLowerCase();
    const isBot = req.method === "HEAD" || !ua || BOT_UA.test(ua);
    if (!isBot) {
      try {
        const already = cookie(req, `pv_${poll.campaign}`);
        if (CONTACT_RE.test(contact) || !already) {
          await store.vote({ campaign: poll.campaign, choice, voter: voterId(req), contact: CONTACT_RE.test(contact) ? contact : "" });
        }
      } catch (err) {
        console.error("polls: vote not saved", err);
      }
    }
    res.cookie(`pv_${poll.campaign}`, String(choice), { maxAge: COOKIE_DAYS * 86_400_000, sameSite: "lax" });
    res.redirect(302, `/poll/${poll.campaign}?voted=1`);
  });

  // Health check for the vote store: which backend is in use and whether it answers (no secrets in the reply).
  app.get("/api/health", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const votes = await store.total();
      res.json({ ok: true, votes_store: store.kind, votes_table: "ok", total_votes: votes });
    } catch (err) {
      console.error("health: vote store check failed", err);
      res.status(503).json({ ok: false, votes_store: store.kind, votes_table: "error", error: (err as Error).message.slice(0, 200) });
    }
  });

  app.get("/api/polls/:campaign", async (req, res) => {
    const poll = loadPoll(req.params.campaign);
    if (!poll) return res.status(404).json({ ok: false, error: "Poll not found" });
    let counts = new Map<number, number>();
    try {
      counts = await store.counts(poll.campaign);
    } catch (err) {
      console.error("polls: could not read votes", err);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      campaign: poll.campaign,
      question: poll.question,
      total,
      results: poll.options.map((label, i) => {
        const votes = counts.get(i) ?? 0;
        return { index: i, label, votes, pct: total ? Math.round((100 * votes) / total) : 0 };
      }),
    });
  });

  return store;
}
