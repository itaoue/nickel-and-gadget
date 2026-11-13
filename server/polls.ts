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
 *
 * A subscriber's first vote on a poll also puts them on the brand's BigMailer list "NAG Poll Clickers" (needs
 * BIGMAILER_API_KEY; the list is found by name and created if missing, or set BIGMAILER_POLL_LIST_ID; "off" turns it off).
 * Each vote row remembers whether its subscriber is on the list (column listed); a few seconds after every start the
 * server adds whoever is not yet (past voters, and votes whose BigMailer call failed). The admin's Polls page has a
 * button that re-sends everyone.
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
  /** Resolves true when this is the subscriber's first vote on the poll (a new row with a contact id). */
  vote(v: Vote): Promise<boolean>;
  /** Every BigMailer contact id that has voted on any poll. */
  contacts(): Promise<string[]>;
  /** Contact ids not yet confirmed on the BigMailer poll-clickers list. */
  unlisted(): Promise<string[]>;
  markListed(contactIds: string[]): Promise<void>;
  counts(campaign: string): Promise<Map<number, number>>;
  /** Total votes stored; throws if the database cannot be reached. */
  total(): Promise<number>;
}

function memoryStore(): Store {
  const votes: Vote[] = [];
  const listed = new Set<string>();
  return {
    kind: "memory",
    async unlisted() {
      return Array.from(new Set(votes.map((v) => v.contact).filter((c) => c && !listed.has(c))));
    },
    async markListed(ids) {
      ids.forEach((c) => listed.add(c));
    },
    async total() {
      return votes.length;
    },
    async vote(v) {
      const prior = votes.find(
        (x) => x.campaign === v.campaign && (v.contact ? x.contact === v.contact : x.voter === v.voter),
      );
      if (prior && v.contact) prior.choice = v.choice;
      else if (!prior) votes.push(v);
      return !prior && !!v.contact;
    },
    async contacts() {
      return Array.from(new Set(votes.map((v) => v.contact).filter(Boolean)));
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
    ALTER TABLE nag_poll_votes ADD COLUMN IF NOT EXISTS listed BOOLEAN NOT NULL DEFAULT false;
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
        const r = await pool.query(
          `INSERT INTO nag_poll_votes (campaign, choice, voter, contact_id) VALUES ($1, $2, $3, $4)
           ON CONFLICT (campaign, contact_id) WHERE contact_id <> '' DO UPDATE SET choice = EXCLUDED.choice, updated_at = now()
           RETURNING (xmax = 0) AS inserted`,
          [v.campaign, v.choice, v.voter, v.contact],
        );
        return r.rows[0]?.inserted === true;
      } else {
        await pool.query(
          `INSERT INTO nag_poll_votes (campaign, choice, voter) VALUES ($1, $2, $3)
           ON CONFLICT (campaign, voter) WHERE contact_id = '' DO NOTHING`,
          [v.campaign, v.choice, v.voter],
        );
        return false;
      }
    },
    async unlisted() {
      await ready;
      const r = await pool.query("SELECT contact_id FROM nag_poll_votes WHERE contact_id <> '' GROUP BY contact_id HAVING NOT bool_or(listed)");
      return r.rows.map((row) => String(row.contact_id));
    },
    async markListed(ids) {
      await ready;
      if (ids.length) await pool.query("UPDATE nag_poll_votes SET listed = true WHERE contact_id = ANY($1) AND NOT listed", [ids]);
    },
    async contacts() {
      await ready;
      const r = await pool.query("SELECT DISTINCT contact_id FROM nag_poll_votes WHERE contact_id <> ''");
      return r.rows.map((row) => String(row.contact_id));
    },
    async counts(campaign) {
      await ready;
      const r = await pool.query("SELECT choice, count(*)::int AS n FROM nag_poll_votes WHERE campaign = $1 GROUP BY choice", [campaign]);
      return new Map(r.rows.map((row) => [Number(row.choice), Number(row.n)]));
    },
  };
}

// ---------- BigMailer "poll clickers" list ----------

const BM_API = "https://api.bigmailer.io/v1";
const BM_BRAND = process.env.BIGMAILER_BRAND_ID || "9d22c1e6-0bdb-4728-9fc7-4ab6316e7d0f";
const POLL_LIST_NAME = "NAG Poll Clickers";
let pollListId: Promise<string> | null = null;

async function bm(key: string, method: string, url: string, body?: unknown): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${BM_API}/brands/${BM_BRAND}${url}`, {
      method,
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (r.status !== 429 || attempt >= 2) return r;
    await new Promise((done) => setTimeout(done, 2000 * (attempt + 1)));
  }
}

/** BIGMAILER_POLL_LIST_ID, else the brand's list named "NAG Poll Clickers" (created on first use). */
async function findPollList(key: string): Promise<string> {
  let cursor = "";
  do {
    const r = await bm(key, "GET", `/lists?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!r.ok) throw new Error(`list lookup ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = (await r.json()) as { data?: { id: string; name: string }[]; has_more?: boolean; cursor?: string };
    const hit = page.data?.find((l) => l.name.trim().toLowerCase() === POLL_LIST_NAME.toLowerCase());
    if (hit) return hit.id;
    cursor = page.has_more && page.cursor ? page.cursor : "";
  } while (cursor);
  const made = await bm(key, "POST", "/lists", { name: POLL_LIST_NAME });
  if (!made.ok) throw new Error(`list create ${made.status} ${(await made.text()).slice(0, 200)}`);
  const id = ((await made.json()) as { id?: string }).id;
  if (!id) throw new Error("list create returned no id");
  console.log(`polls: created the BigMailer list "${POLL_LIST_NAME}" (${id})`);
  return id;
}

/**
 * Put subscribers who voted from the email on the poll-clickers list (list_ids_op=add keeps their other lists).
 * Never throws; resolves the contacts that were updated, or null when it is switched off or the list is unavailable.
 */
export async function addPollClickers(contactIds: string[]): Promise<string[] | null> {
  const key = process.env.BIGMAILER_API_KEY ?? "";
  const fixed = (process.env.BIGMAILER_POLL_LIST_ID ?? "").trim();
  const ids = contactIds.filter((c) => CONTACT_RE.test(c));
  if (!key || fixed.toLowerCase() === "off") return null;
  let list: string;
  try {
    pollListId ??= fixed ? Promise.resolve(fixed) : findPollList(key);
    list = await pollListId;
  } catch (err) {
    pollListId = null; // try again on the next vote
    console.error("polls: BigMailer poll-clickers list unavailable:", (err as Error).message);
    return null;
  }
  const done: string[] = [];
  for (const cid of ids) {
    try {
      const r = await bm(key, "POST", `/contacts/${cid}?list_ids_op=add`, { list_ids: [list] });
      if (r.ok) done.push(cid);
      else console.warn(`polls: list add failed for ${cid}: ${r.status} ${(await r.text()).slice(0, 200)}`); // 404 = contact deleted since the send
    } catch (err) {
      console.warn(`polls: list add failed for ${cid}:`, (err as Error).message);
    }
  }
  return done;
}

/** Add every voter not yet on the list, and remember the ones BigMailer took. Never throws. */
export async function syncPollClickers(store: Store, only?: string[]): Promise<void> {
  try {
    const ids = only ?? (await store.unlisted());
    if (!ids.length) return;
    const done = await addPollClickers(ids);
    if (!done) return;
    await store.markListed(done);
    if (!only) console.log(`polls: added ${done.length} of ${ids.length} past voters to the BigMailer list "${POLL_LIST_NAME}"`);
  } catch (err) {
    console.error("polls: poll-clickers sync failed", err);
  }
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

  setTimeout(() => void syncPollClickers(store), 5000).unref(); // catch up on voters who are not on the BigMailer list yet

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
          const first = await store.vote({ campaign: poll.campaign, choice, voter: voterId(req), contact: CONTACT_RE.test(contact) ? contact : "" });
          if (first) void syncPollClickers(store, [contact]); // off the request: the reader is never held up by BigMailer
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
