import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { registerAdmin } from "./admin";
import { registerPolls } from "./polls";
import { logSignup } from "./signups";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");
  const root = path.resolve(__dirname, ".."); // repo root (dist/.. in production, server/.. in dev): the admin reads guides and issues from it

  app.use(express.json({ limit: "10kb" }));

  // Newsletter signups from the site's forms -> BigMailer (Nickel And Gadget brand), optionally into a signup list.
  // Needs BIGMAILER_API_KEY on Railway. Signups go to the brand's "Website Signups" list (BIGMAILER_SIGNUP_LIST_ID overrides),
  // kept apart from the brand's imported lists.
  const BM_BRAND = process.env.BIGMAILER_BRAND_ID || "9d22c1e6-0bdb-4728-9fc7-4ab6316e7d0f";
  const BM_LIST = process.env.BIGMAILER_SIGNUP_LIST_ID || "9ec3524e-fa2f-4414-af6b-5d7096d77009";
  const recent = new Map<string, number[]>(); // ip -> signup timestamps, a light per-IP rate limit
  app.post("/api/subscribe", async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (req.body?.website) return res.json({ ok: true }); // honeypot filled in: a bot, pretend it worked
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
    }
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
    const now = Date.now();
    const hits = (recent.get(ip) ?? []).filter((t) => now - t < 3_600_000);
    if (hits.length >= 5) return res.status(429).json({ ok: false, error: "Too many attempts. Please try again later." });
    recent.set(ip, [...hits, now]);
    const key = process.env.BIGMAILER_API_KEY;
    if (!key) {
      console.error("subscribe: BIGMAILER_API_KEY is not set; signup not saved");
      return res.status(503).json({ ok: false, error: "Signups are temporarily unavailable. Please try again later." });
    }
    let source = "";
    try {
      source = new URL(String(req.headers.referer ?? "")).pathname;
    } catch {
      // no or bad referer
    }
    try {
      const r = await fetch(`https://api.bigmailer.io/v1/brands/${BM_BRAND}/contacts/upsert`, {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...(BM_LIST && { list_ids: [BM_LIST] }) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        console.error("subscribe: BigMailer", r.status, (await r.text()).slice(0, 300));
        await logSignup(email, "error", source);
        return res.status(502).json({ ok: false, error: "Something went wrong. Please try again." });
      }
      await logSignup(email, "ok", source);
      return res.json({ ok: true });
    } catch (err) {
      console.error("subscribe: BigMailer request failed", err);
      await logSignup(email, "error", source);
      return res.status(502).json({ ok: false, error: "Network error. Please try again." });
    }
  });

  const polls = registerPolls(app, staticPath);
  registerAdmin(app, staticPath, root, polls);

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
