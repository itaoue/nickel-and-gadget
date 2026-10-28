/*
 * Admin pages at /admin, rendered on the server so nothing of them ships in the public bundle.
 *
 * Read-only over what the site already has: guides and newsletter issues are JSON files in the repo (edited through
 * git and the daily pipeline, not here), poll votes and the signup log live in Postgres, and draft / send stats come
 * from BigMailer. Sign-in is one shared password, ADMIN_PASSWORD on Railway; without it the admin is switched off.
 *
 *   /admin              dashboard: counts, health, recent BigMailer sends
 *   /admin/newsletters  every issue: subject, lead, poll, sponsors, BigMailer status and stats
 *   /admin/polls        every poll with its results
 *   /admin/guides       every guide with its products and prices
 *   /admin/signups      the site's signup log (+ /admin/signups.csv)
 *   /admin/sponsors     sponsor creatives from content/newsletter/config.json
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Store } from "./polls";
import { listSignups, signupCounts } from "./signups";

const SITE = "https://www.nickelandgadget.com";
const TZ = "America/Los_Angeles";
const COOKIE = "nag_admin";
const BM = "https://api.bigmailer.io/v1";

interface Product { name: string; maker: string; price: string; url: string }
interface Guide { id: string; slug: string; title: string; category: string; date: string; publishedAt?: string; products?: Product[] }
interface Issue {
  date: string;
  subject: string;
  preheader: string;
  featured: { slug: string; teaser: string };
  recent: { slug: string }[];
  poll?: { question: string; options: string[] };
}
interface Poll { campaign: string; question: string; options: string[]; lead?: string }
interface Banner { name: string; image: string; headline: string; advertiser?: string; group: string; active: boolean; url: string }
interface Campaign {
  id: string; name: string; subject: string; status: string; created: number;
  num_sent: number; num_opens: number; num_clicks: number; num_unsubscribes: number; num_complaints: number; num_hard_bounces: number;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "–");
const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const when = (d: Date) => d.toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function readDir<T>(dir: string, skip: (name: string) => boolean = () => false): T[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && !skip(n));
  } catch {
    return [];
  }
  return names.map((n) => readJson<T>(path.join(dir, n))).filter((x): x is T => x !== null);
}

const published = (g: Guide) => new Date(g.publishedAt ?? g.date);

export function registerAdmin(app: Express, staticPath: string, root: string, polls: Store) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = password ? crypto.createHmac("sha256", password).update("nag-admin-v1").digest("hex") : "";
  const attempts = new Map<string, number[]>(); // ip -> failed sign-in times

  const guides = (): Guide[] =>
    [
      ...(readJson<Guide[]>(path.join(root, "client/src/content/seed-articles.json")) ?? []),
      ...readDir<Guide>(path.join(root, "client/src/content/articles")),
    ].sort((a, b) => +published(b) - +published(a));
  const issues = (): Issue[] =>
    readDir<Issue>(path.join(root, "content/newsletter"), (n) => n === "config.json").sort((a, b) => b.date.localeCompare(a.date));
  const pollFiles = (): Poll[] => readDir<Poll>(path.join(staticPath, "polls")).sort((a, b) => b.campaign.localeCompare(a.campaign));
  const banners = (): Banner[] => readJson<{ sponsors?: { banners?: Banner[] } }>(path.join(root, "content/newsletter/config.json"))?.sponsors?.banners ?? [];

  /** Which banner ran in which slot, read from the issue's view-online copy. */
  const sponsorsOf = (date: string): string[] => {
    let html = "";
    try {
      html = fs.readFileSync(path.join(staticPath, "newsletters", `${date}.html`), "utf8");
    } catch {
      return [];
    }
    const found = new Set<string>();
    for (const m of Array.from(html.matchAll(/external_id=nag_[\d-]+_(top|mid)_([\w-]+)|sub3=(top|mid)&(?:amp;)?sub4=([\w-]+)/g))) {
      found.add(`${m[1] ?? m[3]}: ${m[2] ?? m[4]}`);
    }
    return Array.from(found).sort((a, b) => b.localeCompare(a)); // top before mid
  };

  // BigMailer: NAG Daily campaigns and the signup list, cached for a minute
  let bmCache: { at: number; campaigns: Campaign[]; listCount: number | null; error: string } | null = null;
  const bigmailer = async () => {
    if (bmCache && Date.now() - bmCache.at < 60_000) return bmCache;
    const key = process.env.BIGMAILER_API_KEY;
    const brand = process.env.BIGMAILER_BRAND_ID || "9d22c1e6-0bdb-4728-9fc7-4ab6316e7d0f";
    const list = process.env.BIGMAILER_SIGNUP_LIST_ID || "9ec3524e-fa2f-4414-af6b-5d7096d77009";
    if (!key) return { at: Date.now(), campaigns: [], listCount: null, error: "BIGMAILER_API_KEY is not set" };
    const get = async (p: string) => {
      const r = await fetch(`${BM}${p}`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`BigMailer ${r.status}`);
      return r.json();
    };
    try {
      const [c, l] = await Promise.all([get(`/brands/${brand}/bulk-campaigns?limit=100`), get(`/brands/${brand}/lists/${list}`)]);
      const campaigns = (c.data as Campaign[]).filter((x) => x.name.startsWith("NAG Daily"));
      bmCache = { at: Date.now(), campaigns, listCount: l.num_contacts ?? null, error: "" };
    } catch (err) {
      bmCache = { at: Date.now(), campaigns: bmCache?.campaigns ?? [], listCount: bmCache?.listCount ?? null, error: (err as Error).message };
    }
    return bmCache;
  };
  const campaignFor = (cs: Campaign[], date: string) => {
    const [, m, d] = date.split("-");
    return cs.find((c) => c.name.startsWith(`NAG Daily ${m}/${d} `));
  };

  const pollResults = async (p: Poll) => {
    let counts = new Map<number, number>();
    try {
      counts = await polls.counts(p.campaign);
    } catch (err) {
      console.error("admin: poll counts", err);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    return { total, rows: p.options.map((label, i) => ({ label, votes: counts.get(i) ?? 0 })) };
  };

  // ---------- auth ----------

  const signedIn = (req: Request) => {
    const m = (req.headers.cookie ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{64})`));
    return !!token && !!m && crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(token));
  };
  const ipOf = (req: Request) =>
    String(req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

  const router = express.Router();
  router.use((_req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Frame-Options": "DENY" });
    next();
  });
  router.use(express.urlencoded({ extended: false, limit: "2kb" }));

  router.get("/login", (req, res) => {
    if (!password) return res.status(503).send(page("Admin is off", `<p>Set <code>ADMIN_PASSWORD</code> on Railway to turn the admin on.</p>`, ""));
    if (signedIn(req)) return res.redirect("/admin");
    res.send(loginPage(req.query.e ? "Wrong password." : ""));
  });

  router.post("/login", (req, res) => {
    if (!password) return res.redirect("/admin/login");
    const ip = ipOf(req);
    const now = Date.now();
    const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
    if (recent.length >= 8) return res.status(429).send(loginPage("Too many attempts. Try again in 15 minutes."));
    const given = crypto.createHash("sha256").update(String(req.body?.password ?? "")).digest();
    const want = crypto.createHash("sha256").update(password).digest();
    if (!crypto.timingSafeEqual(given, want)) {
      attempts.set(ip, [...recent, now]);
      return res.redirect("/admin/login?e=1");
    }
    attempts.delete(ip);
    res.cookie(COOKIE, token, {
      httpOnly: true, sameSite: "strict", path: "/admin", maxAge: 30 * 86_400_000,
      secure: process.env.NODE_ENV === "production",
    });
    res.redirect("/admin");
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(COOKIE, { path: "/admin" });
    res.redirect("/admin/login");
  });

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!password) return res.redirect("/admin/login");
    if (!signedIn(req)) return res.redirect("/admin/login");
    next();
  });

  // ---------- pages ----------

  router.get("/", async (_req, res) => {
    const gs = guides();
    const today = day(new Date());
    const weekAgo = Date.now() - 7 * 86_400_000;
    const is = issues();
    const ps = pollFiles();
    const [bm, sc, votes, latestPoll] = await Promise.all([
      bigmailer(),
      signupCounts().catch(() => null),
      polls.total().catch(() => null),
      ps[0] ? pollResults(ps[0]) : Promise.resolve(null),
    ]);
    const next = is[0];
    const nextDraft = next ? campaignFor(bm.campaigns, next.date) : undefined;
    const sent = bm.campaigns.filter((c) => c.num_sent > 0).slice(0, 10); // BigMailer marks a finished send "complete"

    const tiles = [
      ["Guides", gs.length, `${gs.filter((g) => day(published(g)) === today).length} today · ${gs.filter((g) => +published(g) > weekAgo).length} this week`, "/admin/guides"],
      ["Newest issue", next ? next.date : "–", nextDraft ? `BigMailer: ${nextDraft.status}` : "no BigMailer draft found", "/admin/newsletters"],
      ["Poll votes", votes ?? "–", latestPoll && ps[0] ? `${latestPoll.total} on ${ps[0].campaign}` : "no polls yet", "/admin/polls"],
      ["Site signups", sc?.total ?? "–", sc ? `${sc.today} today · ${sc.week} this week` : "log unavailable", "/admin/signups"],
      ["Website Signups list", bm.listCount ?? "–", "contacts in BigMailer", "/admin/signups"],
    ]
      .map(([t, v, s, href]) => `<a class="tile" href="${href}"><span>${esc(t)}</span><strong>${esc(v)}</strong><small>${esc(s)}</small></a>`)
      .join("");

    const health = [
      ["Vote / signup store", polls.kind === "postgres" ? "Postgres" : "memory (lost on deploy)", polls.kind === "postgres"],
      ["BigMailer API", bm.error || "ok", !bm.error],
    ]
      .map(([k, v, ok]) => `<li><span class="dot ${ok ? "ok" : "bad"}"></span>${esc(k)}: <b>${esc(v)}</b></li>`)
      .join("");

    const sentRows = sent.length
      ? sent
          .map(
            (c) => `<tr><td class="nw">${esc(c.name.slice(10, 15))}</td><td>${esc(c.subject)}</td><td class="n">${c.num_sent.toLocaleString()}</td>
<td class="n">${pct(c.num_opens, c.num_sent)}</td><td class="n">${pct(c.num_clicks, c.num_sent)}</td><td class="n">${pct(c.num_clicks, c.num_opens)}</td>
<td class="n">${c.num_unsubscribes}</td><td class="n">${c.num_complaints}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="8" class="muted">No NAG Daily campaign has been sent yet.</td></tr>`;

    res.send(
      page(
        "Dashboard",
        `<div class="tiles">${tiles}</div>
<h2>Health</h2><ul class="health">${health}</ul>
<h2>Recent sends</h2>
<div class="scroll"><table><thead><tr><th>Date</th><th>Subject</th><th class="n">Sent</th><th class="n">Opens</th><th class="n">Clicks</th><th class="n">CTOR</th><th class="n">Unsubs</th><th class="n">Complaints</th></tr></thead>
<tbody>${sentRows}</tbody></table></div>
<p class="muted">Opens and clicks are unique contacts. BigMailer data refreshes every minute.</p>`,
        "/admin",
      ),
    );
  });

  router.get("/newsletters", async (_req, res) => {
    const bm = await bigmailer();
    const byslug = new Map(guides().map((g) => [g.slug, g]));
    const rows = issues()
      .map((is) => {
        const c = campaignFor(bm.campaigns, is.date);
        const lead = byslug.get(is.featured.slug);
        const stats = c
          ? c.num_sent > 0
            ? `${c.num_sent.toLocaleString()} sent · ${pct(c.num_opens, c.num_sent)} open · ${pct(c.num_clicks, c.num_sent)} click · ${c.num_unsubscribes} unsub`
            : `<span class="tag">${esc(c.status)}</span>`
          : `<span class="muted">no draft</span>`;
        return `<tr><td class="nw"><b>${esc(is.date)}</b></td>
<td>${esc(is.subject)}<br><small class="muted">${esc(is.preheader)}</small></td>
<td>${lead ? `<a href="/articles/${esc(lead.slug)}" target="_blank">${esc(lead.title)}</a>` : esc(is.featured.slug)}<br><small class="muted">+ ${is.recent.length} more guides</small></td>
<td>${is.poll ? `<a href="/admin/polls#p-${esc(is.date)}">${esc(is.poll.question)}</a>` : `<span class="muted">none</span>`}</td>
<td><small>${sponsorsOf(is.date).map(esc).join("<br>") || "–"}</small></td>
<td>${stats}</td>
<td><a href="/newsletters/${esc(is.date)}.html" target="_blank">View</a></td></tr>`;
      })
      .join("");
    res.send(
      page(
        "Newsletters",
        `${bm.error ? `<p class="warn">BigMailer: ${esc(bm.error)}</p>` : ""}
<div class="scroll"><table><thead><tr><th>Date</th><th>Subject / preheader</th><th>Lead guide</th><th>Poll</th><th>Sponsors</th><th>BigMailer</th><th></th></tr></thead>
<tbody>${rows || `<tr><td colspan="7" class="muted">No issues yet.</td></tr>`}</tbody></table></div>
<p class="muted">Issues are built by the daily workflow (or <code>tools/build_newsletter.py</code>) and pushed to BigMailer as drafts with no lists; choose lists and send in BigMailer.</p>`,
        "/admin/newsletters",
      ),
    );
  });

  router.get("/polls", async (_req, res) => {
    const ps = pollFiles();
    const blocks = await Promise.all(
      ps.map(async (p) => {
        const r = await pollResults(p);
        const bars = r.rows
          .map(
            (o) => `<div class="bar"><div class="bar__label"><span>${esc(o.label)}</span><b>${o.votes} · ${r.total ? Math.round((100 * o.votes) / r.total) : 0}%</b></div>
<div class="bar__track"><div style="width:${r.total ? (100 * o.votes) / r.total : 0}%"></div></div></div>`,
          )
          .join("");
        return `<section class="card" id="p-${esc(p.campaign)}"><div class="card__head"><span class="tag">${esc(p.campaign)}</span><b>${r.total} vote${r.total === 1 ? "" : "s"}</b></div>
<h3>${esc(p.question)}</h3>${bars}
<p class="muted"><a href="/poll/${esc(p.campaign)}" target="_blank">Public results page</a>${p.lead ? ` · lead: <a href="/articles/${esc(p.lead)}" target="_blank">${esc(p.lead)}</a>` : ""}</p></section>`;
      }),
    );
    res.send(
      page(
        "Polls",
        `${polls.kind === "memory" ? `<p class="warn">Votes are kept in memory and are lost on every deploy: set DATABASE_URL.</p>` : ""}
${blocks.join("") || `<p class="muted">No polls yet.</p>`}
<p class="muted">One vote per subscriber via the email link (last click wins); link scanners and bots are not counted.</p>`,
        "/admin/polls",
      ),
    );
  });

  router.get("/guides", (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const gs = guides().filter((g) => !q || `${g.title} ${g.category} ${(g.products ?? []).map((p) => `${p.maker} ${p.name}`).join(" ")}`.toLowerCase().includes(q));
    const cats = new Map<string, number>();
    for (const g of guides()) cats.set(g.category, (cats.get(g.category) ?? 0) + 1);
    const rows = gs
      .map((g) => {
        const products = (g.products ?? [])
          .map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.name.toLowerCase().includes(p.maker.toLowerCase()) ? p.name : `${p.maker} ${p.name}`)}</a> <span class="price">${esc(p.price)}</span></li>`)
          .join("");
        return `<tr><td class="nw">${esc(day(published(g)))}</td><td><a href="/articles/${esc(g.slug)}" target="_blank"><b>${esc(g.title)}</b></a><br><small class="muted">${esc(g.category)}</small></td>
<td>${products ? `<ul class="plain">${products}</ul>` : `<span class="muted">no products</span>`}</td></tr>`;
      })
      .join("");
    const catList = Array.from(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<a class="tag" href="/admin/guides?q=${encodeURIComponent(c)}">${esc(c)} ${n}</a>`).join(" ");
    res.send(
      page(
        "Guides",
        `<form class="search" method="get"><input name="q" value="${esc(q)}" placeholder="Search title, category or product"><button>Search</button>${q ? ` <a href="/admin/guides">Clear</a>` : ""}</form>
<p>${catList}</p>
<div class="scroll"><table><thead><tr><th>Published (PT)</th><th>Guide</th><th>Products and published prices</th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="muted">Nothing found.</td></tr>`}</tbody></table></div>
<p class="muted">Guides are JSON files in <code>client/src/content/articles/</code>; edit them in git (the daily pipeline adds 3 a day).</p>`,
        "/admin/guides",
      ),
    );
  });

  router.get("/signups", async (_req, res) => {
    const [list, counts, bm] = await Promise.all([listSignups(500).catch(() => null), signupCounts().catch(() => null), bigmailer()]);
    const rows = (list ?? [])
      .map((s) => `<tr><td>${esc(when(new Date(s.created_at)))}</td><td>${esc(s.email)}</td><td>${s.status === "ok" ? "saved" : `<span class="bad-text">BigMailer error</span>`}</td><td><small>${esc(s.source)}</small></td></tr>`)
      .join("");
    res.send(
      page(
        "Signups",
        `<div class="tiles">
<div class="tile"><span>Logged signups</span><strong>${counts?.total ?? "–"}</strong><small>${counts ? `${counts.today} today · ${counts.week} this week` : "log unavailable"}</small></div>
<div class="tile"><span>Website Signups list</span><strong>${bm.listCount ?? "–"}</strong><small>contacts in BigMailer</small></div></div>
<p><a class="button" href="/admin/signups.csv">Download CSV</a></p>
<div class="scroll"><table><thead><tr><th>When (PT)</th><th>Email</th><th>Result</th><th>Page</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="muted">No signups logged yet.</td></tr>`}</tbody></table></div>
<p class="muted">Newest 500 from the site's forms. The BigMailer list is the list of record (it also drops unsubscribes).</p>`,
        "/admin/signups",
      ),
    );
  });

  router.get("/signups.csv", async (_req, res) => {
    const list = await listSignups(100_000).catch(() => []);
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = ["created_at,email,status,source", ...list.map((s) => [new Date(s.created_at).toISOString(), s.email, s.status, s.source].map(cell).join(","))].join("\n");
    res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nag-signups-${day(new Date())}.csv"` });
    res.send(csv + "\n");
  });

  router.get("/sponsors", (_req, res) => {
    const runs = new Map<string, string[]>();
    for (const is of issues()) for (const s of sponsorsOf(is.date)) {
      const name = s.split(": ")[1];
      runs.set(name, [...(runs.get(name) ?? []), is.date]);
    }
    const cards = banners()
      .map(
        (b) => `<section class="card sponsor${b.active ? "" : " off"}"><img src="${esc(b.image)}" alt="">
<div><div class="card__head"><span class="tag">${esc(b.group)}</span><b>${b.active ? "active" : "paused"}</b></div>
<h3>${esc(b.headline)}</h3><p class="muted">${esc(b.name)} · ${esc(b.advertiser ?? "")}</p>
<p><small>Ran: ${(runs.get(b.name) ?? []).map(esc).join(", ") || "not yet"}</small></p>
<p><small class="url">${esc(b.url)}</small></p></div></section>`,
      )
      .join("");
    res.send(
      page(
        "Sponsors",
        `${cards || `<p class="muted">No sponsor creatives configured.</p>`}
<p class="muted">Creatives live in <code>content/newsletter/config.json</code>; each issue rotates two different groups (top and mid). Links always carry <code>nag</code> as sub1 / external_id prefix.</p>`,
        "/admin/sponsors",
      ),
    );
  });

  app.use("/admin", router);
}

// ---------- layout ----------

const NAV: [string, string][] = [
  ["/admin", "Dashboard"],
  ["/admin/newsletters", "Newsletters"],
  ["/admin/polls", "Polls"],
  ["/admin/guides", "Guides"],
  ["/admin/signups", "Signups"],
  ["/admin/sponsors", "Sponsors"],
];

const CSS = `
:root{--accent:#1f6fb2;--ink:#222;--muted:#7a8288;--line:#e3e7ea;--bg:#f2f4f7;--ok:#2e8b57;--bad:#c0392b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
a{color:var(--accent)}header{background:#1a2430;color:#fff}header .in{max-width:1180px;margin:0 auto;padding:0 16px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
header .brand{font-weight:700;padding:14px 0;color:#fff;text-decoration:none}header nav{display:flex;gap:2px;flex-wrap:wrap;flex:1}
header nav a{color:#c9d3dc;text-decoration:none;padding:14px 10px;border-bottom:3px solid transparent}header nav a.on{color:#fff;border-color:var(--accent)}
header form button{background:none;border:1px solid #556;color:#c9d3dc;padding:5px 10px;border-radius:4px;cursor:pointer}
main{max-width:1180px;margin:0 auto;padding:22px 16px 60px}h1{font-size:22px;margin:0 0 18px}h2{font-size:16px;margin:28px 0 10px}h3{font-size:16px;margin:8px 0 12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.tile{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px;text-decoration:none;color:var(--ink);display:flex;flex-direction:column}
.tile span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.tile strong{font-size:26px;margin:4px 0}.tile small{color:var(--muted)}
.scroll{overflow-x:auto;background:#fff;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:9px 11px;border-bottom:1px solid var(--line);vertical-align:top}th{background:#f8f9fa;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}
td.n,th.n{text-align:right;white-space:nowrap}.nw{white-space:nowrap}.muted{color:var(--muted)}.tag{display:inline-block;background:#e6eef6;color:var(--accent);border-radius:10px;padding:1px 9px;font-size:12px;text-decoration:none;margin:0 4px 4px 0}
.health{list-style:none;padding:0;margin:0}.health li{margin:4px 0}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px}.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}
.warn{background:#fff4e5;border:1px solid #f0c27a;padding:10px 12px;border-radius:6px}.bad-text{color:var(--bad)}
.card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:14px}.card__head{display:flex;justify-content:space-between;align-items:center}
.bar{margin:8px 0}.bar__label{display:flex;justify-content:space-between;gap:10px}.bar__track{height:16px;background:#e6eef6;border-radius:3px;overflow:hidden;margin-top:3px}.bar__track div{height:100%;background:var(--accent);min-width:2px}
.sponsor{display:grid;grid-template-columns:200px 1fr;gap:16px}.sponsor img{width:100%;border-radius:6px}.sponsor.off{opacity:.55}.url{word-break:break-all;color:var(--muted)}
ul.plain{margin:0;padding-left:16px}.price{color:#a85a14;white-space:nowrap}
.search{display:flex;gap:8px;align-items:center;margin-bottom:10px}.search input{flex:1;max-width:380px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font:inherit}
button,.button{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:8px 14px;font:inherit;cursor:pointer;text-decoration:none;display:inline-block}
.login{max-width:340px;margin:12vh auto;background:#fff;border:1px solid var(--line);border-radius:10px;padding:26px}.login input{width:100%;padding:10px;margin:10px 0 14px;border:1px solid var(--line);border-radius:6px;font:inherit}
@media(max-width:640px){.sponsor{grid-template-columns:1fr}header nav a{padding:10px 7px}}
`;

function page(title: string, body: string, current: string): string {
  const nav = current
    ? `<nav>${NAV.map(([href, label]) => `<a href="${href}"${href === current ? ' class="on"' : ""}>${label}</a>`).join("")}</nav>
<form method="post" action="/admin/logout"><button>Sign out</button></form>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(title)} · NAG Admin</title><style>${CSS}</style></head>
<body><header><div class="in"><a class="brand" href="/admin">Nickel &amp; Gadget · Admin</a>${nav}</div></header>
<main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

function loginPage(error: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Sign in · NAG Admin</title><style>${CSS}</style></head>
<body><form class="login" method="post" action="/admin/login"><h1>NAG Admin</h1>
${error ? `<p class="bad-text">${esc(error)}</p>` : ""}
<label>Password<input type="password" name="password" autocomplete="current-password" autofocus required></label>
<button style="width:100%">Sign in</button></form></body></html>`;
}
