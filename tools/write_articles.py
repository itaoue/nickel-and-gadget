#!/usr/bin/env python3
"""
Write senior-friendly gadget guides for Nickel And Gadget with Claude.

Each article is saved as client/src/content/articles/<slug>.json (the site loads every file in that
folder at build time) with a cover image at client/public/uploads/yyyy/mm/<slug>.jpg. The GitHub
Actions workflow (.github/workflows/content.yml) commits the files, and the push redeploys Railway.

    python tools/write_articles.py                       # 3 articles, categories rotated
    python tools/write_articles.py --count 1 --category "Smart Home"
    python tools/write_articles.py --daily 3             # top today's (Pacific) batch up to 3; no-op once done
    python tools/write_articles.py --dry-run             # show the categories it would write, call nothing

Per article: (1) Claude picks a gadget topic in the category that older readers would care about, different
from every article on the site, and researches it from makers' and retailers' product pages plus credible
reviews and official sources (web search + fetch) into notes; (2) Claude writes the guide as structured JSON,
including 2 to 4 real products with the price the seller published; (3) every product link must appear in the
notes, and a second pass acts as editor and checks every product, price and claim against the notes, revising
or rejecting; (4) xAI generates the cover image; (5) the JSON is written to disk.

Environment: ANTHROPIC_API_KEY, XAI_API_KEY, optional STORY_AUTHOR / STORY_AUTHOR_ROLE (byline),
STORY_EFFORT (default medium), STORY_MODEL (default claude-opus-5-5), RESEARCH_MODEL / EDITOR_MODEL
(default claude-sonnet-5-5). Every call prints its token usage and estimated cost.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import sys
import time
import traceback
import zoneinfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "client" / "src" / "content" / "articles"
SEED = ROOT / "client" / "src" / "content" / "seed-articles.json"
UPLOADS = ROOT / "client" / "public" / "uploads"
sys.path.insert(0, str(ROOT / "tools"))

MODEL = os.environ.get("STORY_MODEL", "claude-opus-5-5")
RESEARCH_MODEL = os.environ.get("RESEARCH_MODEL", "claude-sonnet-5-5")
EDITOR_MODEL = os.environ.get("EDITOR_MODEL", "claude-sonnet-5-5")
EFFORT = os.environ.get("STORY_EFFORT", "medium")
AUTHOR = os.environ.get("STORY_AUTHOR", "Nickel And Gadget Editors")
AUTHOR_ROLE = os.environ.get("STORY_AUTHOR_ROLE", "Editorial desk")
TZ = zoneinfo.ZoneInfo("America/Los_Angeles")
PRICES = {  # $ per million tokens: input, output, cache read, cache write
    "claude-opus-5-5": (4.0, 20.0, 0.2, 5.0), "claude-sonnet-5-5": (2.0, 10.0, 0.2, 2.5),
}
USAGE = {"calls": 0, "cost": 0.0}
CATEGORIES = ["Health & Safety", "Smart Home", "Phones & Tablets", "Hearing & Vision", "Home & Kitchen", "Gift Ideas"]
FALLBACK_IMAGE = "/images/fallback-cover.jpg"  # used only if image generation fails

# What each category covers, so the topics stay varied and useful.
SCOPE = {
    "Health & Safety": "medical alert systems and fall detection, blood pressure monitors, pill dispensers and medication reminders, "
                       "night lights and motion lighting, bathroom safety (grab bars, shower seats), smoke/CO alarms, mobility aids",
    "Smart Home": "smart speakers and displays, video doorbells and cameras, smart plugs and lights, thermostats, robot vacuums, "
                  "door locks, leak sensors, setting up voice reminders and video calls",
    "Phones & Tablets": "easy phones and senior plans, tablets for video calls, simplifying a smartphone (Assistive Access, simple modes), "
                        "phone accessories (big-button cases, stands, chargers), avoiding scam calls and texts",
    "Hearing & Vision": "OTC hearing aids, TV listening devices, amplified and captioned phones, magnifiers and reading lights, "
                        "large-display clocks, e-readers with large text, audiobooks",
    "Home & Kitchen": "tools for stiff or arthritic hands (jar openers, reachers, easy-grip utensils), small appliances that are easy "
                      "to use, auto shut-off devices, cordless and lightweight cleaning tools, gardening helpers",
    "Gift Ideas": "gifts for parents and grandparents: digital photo frames, comfort and warmth (heated throws, slippers), "
                  "hobby gadgets, memory and family-story tools, stocking stuffers under $30, gifts from grandkids",
}

AUDIENCE = (
    "READER RELEVANCE comes first. Our readers are mostly adults aged 60 to 85, plus adult children shopping for their parents. "
    "They want gadgets that are EASY to use and solve a real everyday problem: staying safe and independent at home, keeping in touch "
    "with family, hearing and seeing better, coping with stiff hands, and finding good gifts. Pick a topic a reader could act on this week "
    "(buy, set up, or give), not tech news or a single product launch. Prefer products sold by major makers and retailers in the US, "
    "currently available, with a published price. Avoid anything medical beyond consumer devices (no prescription devices, no supplements), "
    "and avoid crypto, investments and anything that needs a long contract unless the article explains the fees plainly."
)

SYSTEM = """You write for Nickel And Gadget, a site and daily email that explains senior-friendly gadgets in plain English for readers aged 60 to 85 and the adult children who shop for them. Voice: warm, practical and patient, like a helpful neighbor who knows tech; plain English; short paragraphs; no jargon (explain any tech term in a few words); no hype. Every article is ORIGINAL WRITING built only from the facts in the research notes.

Accuracy rules (non-negotiable):
- Every product name, maker, price, fee, feature and spec must come from the notes. Write prices as the seller published them, with the month, e.g. "about $199 (list price, October 2026)". Never invent or estimate a price; if the notes do not give one, write "check current price".
- Each product's url must be exactly the product page URL given in the notes.
- Never claim or imply that we tested, used, handled or reviewed anything ourselves ("we tried", "in our testing", "we loved"). Never invent customers, stories, quotes, star ratings, review counts, stock levels or deadlines. Quote people only in the exact words the notes give, at most two quotes, attributed.
- Say plainly what a gadget cannot do (e.g. a smart speaker is not a monitored medical alert; fall detection does not catch every fall; OTC hearing aids are for perceived mild-to-moderate loss).
- No medical advice: for health devices, point readers to their doctor, pharmacist or audiologist where relevant. In an emergency, call 911.
- No "game-changer", "must-have", "miracle", "life-changing", no fake urgency, no ALL CAPS, no emoji.
- Do not copy or closely paraphrase sentences from any source. Never narrate the research process ("we could not load the page"); leave out what the notes cannot confirm.
- Blogs, Substack, social media and forums are never sources; use makers, retailers, official bodies (FDA, FTC, NIH, CDC, FCC) and reputable reviewers and news outlets.
- Write in American English.

Structure: 1-2 opening paragraphs on the everyday problem the gadget solves; a section on how it works or what the options are; a section "What to look for" with a "list" of practical buying tips (fees, battery, buttons and screen size, returns, setup help); then exactly one {"type": "products"} block where the product cards appear (the cards render from the separate `products` array: 2 to 4 real products, each with name, maker, price, url and a one- or two-sentence blurb on who it suits and its key feature); then a short section on setting it up or using it well; exactly one "callout" (label like "Good to Know", "Before You Buy" or "Setup Tip"); close with a short, friendly paragraph. 600 to 900 words in total, not counting the product cards. Use "subheading" and "quote" blocks only when they genuinely help.

Title: friendly, specific and useful, e.g. "Medical Alert Systems With Fall Detection: What They Do, What They Cost" or "The Easiest Phones for Seniors in 2026, and the Plans Behind Them". Subtitle: one sentence that frames the article. Excerpt: one or two sentences that stand alone on a card or in an email. Tags: 3 to 5 short topic tags."""

BLOCK = {
    "type": "object", "additionalProperties": False, "required": ["type", "content", "items", "label"],
    "properties": {
        "type": {"type": "string", "enum": ["paragraph", "heading", "subheading", "quote", "callout", "list", "products"]},
        "content": {"type": "string", "description": "text of the block; empty for a list or the products marker"},
        "items": {"type": "array", "items": {"type": "string"}, "description": "list items; empty unless type is list"},
        "label": {"type": "string", "description": "callout label; empty unless type is callout"},
    },
}
PRODUCTS = {"type": "array", "description": "2 to 4 real products, in the order they should appear",
            "items": {"type": "object", "additionalProperties": False, "required": ["name", "maker", "price", "url", "blurb"],
                      "properties": {"name": {"type": "string"}, "maker": {"type": "string"},
                                     "price": {"type": "string", "description": "as published, with the month, or 'Check current price'"},
                                     "url": {"type": "string", "description": "the product page URL exactly as given in the notes"},
                                     "blurb": {"type": "string", "description": "one or two sentences: who it suits and the key feature"}}}}
SOURCES = {"type": "array", "description": "2 to 6 sources: product pages and the reviews or official pages used",
           "items": {"type": "object", "additionalProperties": False, "required": ["label", "url"],
                     "properties": {"label": {"type": "string"}, "url": {"type": "string"}}}}
SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["title", "slug", "subtitle", "excerpt", "tags", "sections", "products", "sources", "image_scene"],
    "properties": {
        "title": {"type": "string"},
        "slug": {"type": "string", "description": "lowercase, hyphenated, 4 to 8 words, no dates"},
        "subtitle": {"type": "string"},
        "excerpt": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "sections": {"type": "array", "items": BLOCK},
        "products": PRODUCTS,
        "sources": SOURCES,
        "image_scene": {"type": "string", "description": "one sentence: a photorealistic scene for the cover image, the kind of gadget in an everyday home setting; older hands welcome; no faces, no text, no screens showing text, no brand logos"},
    },
}
REVISE_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["title", "subtitle", "excerpt", "sections", "products", "changes"],
    "properties": {
        "title": {"type": "string"}, "subtitle": {"type": "string"}, "excerpt": {"type": "string"},
        "sections": {"type": "array", "items": BLOCK}, "products": PRODUCTS,
        "changes": {"type": "array", "items": {"type": "string"}, "description": "one line per fix made"},
    },
}
EDITOR_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["verdict", "notes", "issues"],
    "properties": {
        "verdict": {"type": "string", "enum": ["approve", "revise", "reject"]},
        "notes": {"type": "string"},
        "issues": {"type": "array", "items": {"type": "string"}},
    },
}


# ─── site state ───────────────────────────────────────────────

def load_pipeline():
    out = []
    for f in sorted(ARTICLES.glob("*.json")):
        try:
            out.append(json.loads(f.read_text()))
        except json.JSONDecodeError:
            print(f"  skipping unreadable {f.name}")
    return out


def existing():
    """(title, slug, category, published datetime) for every article on the site, seed + pipeline."""
    rows = []
    for a in json.loads(SEED.read_text()):
        when = dt.datetime.fromisoformat(a["publishedAt"]) if a.get("publishedAt") else \
            dt.datetime.strptime(a["date"], "%B %d, %Y").replace(tzinfo=TZ)
        rows.append((a["title"], a["slug"], a["category"], when))
    for a in load_pipeline():
        rows.append((a["title"], a["slug"], a["category"], dt.datetime.fromisoformat(a["publishedAt"])))
    return rows


def pick_categories(count, rows, forced=None):
    """Least recently covered categories first, so every topic keeps getting fresh stories."""
    if forced:
        return [forced] * count
    last = {c: dt.datetime.min.replace(tzinfo=TZ) for c in CATEGORIES}
    for _, _, cat, when in rows:
        if cat in last and when > last[cat]:
            last[cat] = when
    order = sorted(CATEGORIES, key=lambda c: last[c])
    return [order[i % len(order)] for i in range(count)]


def written_today(rows):
    today = dt.datetime.now(TZ).date()
    return sum(1 for a in load_pipeline() if dt.datetime.fromisoformat(a["publishedAt"]).astimezone(TZ).date() == today)


def norm_words(t):
    return {w for w in re.findall(r"[a-z0-9]+", t.lower()) if len(w) > 3}


def too_similar(title, titles, threshold=0.6):
    a = norm_words(title)
    for t in titles:
        b = norm_words(t)
        if a and b and len(a & b) / min(len(a), len(b)) >= threshold:
            return t
    return None


# ─── Claude ───────────────────────────────────────────────────

def record_usage(msg, model):
    u = msg.usage
    inp, out = u.input_tokens, u.output_tokens
    cr = getattr(u, "cache_read_input_tokens", 0) or 0
    cw = getattr(u, "cache_creation_input_tokens", 0) or 0
    pi, po, pr, pw = PRICES.get(model, PRICES["claude-opus-5-5"])
    st = getattr(u, "server_tool_use", None)
    searches = (getattr(st, "web_search_requests", 0) or 0) if st is not None else 0
    cost = (inp * pi + out * po + cr * pr + cw * pw) / 1e6 + searches * 0.01
    USAGE["calls"] += 1
    USAGE["cost"] += cost
    print(f"    usage: in={inp} cache_read={cr} cache_write={cw} out={out} searches={searches} -> ${cost:.3f}")


def stream(client, **kwargs):
    """One streamed request at the configured effort; retries overloaded / 5xx / connection errors."""
    import anthropic

    kwargs["output_config"] = {**kwargs.get("output_config", {}), "effort": EFFORT}
    for attempt in range(4):
        try:
            with client.messages.stream(**kwargs) as s:
                msg = s.get_final_message()
            record_usage(msg, kwargs.get("model", MODEL))
            return msg
        except (anthropic.APIConnectionError, anthropic.RateLimitError, anthropic.InternalServerError) as exc:
            wait = 30 * (attempt + 1)
            print(f"  transient API error ({exc.__class__.__name__}); retrying in {wait}s")
            time.sleep(wait)
        except anthropic.APIStatusError as exc:
            if exc.status_code >= 500 or "overloaded" in str(exc).lower():
                wait = 30 * (attempt + 1)
                print(f"  API {exc.status_code}; retrying in {wait}s")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("API kept failing after retries")


def json_out(msg, what):
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"model declined the {what}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError(f"{what} JSON was cut off at max_tokens")
    return json.loads(next(b.text for b in msg.content if b.type == "text"))


def research(client, category, titles, today, avoid=()):
    tools = [{"type": "web_search_20260209", "name": "web_search", "max_uses": 6},
             {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 6, "max_content_tokens": 8000}]
    recent = "\n".join(f"- {t}" for t in [*titles[-60:], *avoid])
    ask = (f"Today is {today}. Choose ONE gadget topic in the category {category.upper()} ({SCOPE[category]}) for a Nickel And Gadget "
           "buying guide, and research it.\n\n"
           f"{AUDIENCE}\n\n"
           f"It must be clearly different from these articles already on the site:\n{recent}\n\n"
           "Research: find 2 to 4 real products that fit, currently sold in the US by the maker or a major retailer. For each one, FETCH its "
           "product page (maker's site preferred; a major retailer is fine) and record what the page states. Then read one or two credible "
           "independent sources (Consumer Reports, Wirecutter, AARP, reputable tech or news outlets, or an official page such as FDA/FTC/FCC) "
           "for context on what to look for and the category's limits. Skip blogs, Substack, social posts, forums, and listicles that only "
           "repeat Amazon descriptions. Do not write the article yet. Return compact plain-text notes, under 900 words:\n"
           "TOPIC: one line naming the guide.\n"
           "(1) PRODUCTS: for each product, one block: name, maker, product page URL exactly as fetched, the price shown on that page (and any "
           "monthly fee or subscription) with today's month, and the key features and specs the page states, one per line;\n"
           "(2) context sources read: URL, publisher, date, and the useful facts from each, one per line;\n"
           "(3) limits and cautions: what this kind of gadget cannot do, hidden costs, who it does not suit;\n"
           "(4) up to two short verbatim quotes with who said them and where.\n"
           "End with exactly one line: PRODUCT_PAGES_READ: <number of product pages you actually fetched and read>.")
    messages = [{"role": "user", "content": ask}]
    for _ in range(3):
        msg = stream(client, model=RESEARCH_MODEL, max_tokens=12000, tools=tools, messages=messages, cache_control={"type": "ephemeral"})
        messages.append({"role": "assistant", "content": msg.content})
        if msg.stop_reason != "pause_turn":
            break
    if msg.stop_reason == "refusal":
        raise RuntimeError("research declined by the model")
    notes = "\n".join(b.text for b in msg.content if b.type == "text").strip()
    if not notes:
        raise RuntimeError("research returned no notes")
    m = re.search(r"PRODUCT_PAGES_READ:\s*(\d+)", notes)
    return notes, int(m.group(1)) if m else 0


def topic_of(notes):
    m = re.search(r"TOPIC:\s*(.+)", notes)
    return (m.group(1) if m else notes.splitlines()[0]).strip()[:150]


def research_solid(client, category, titles, today, attempts=2):
    """Research until at least two product pages were actually read; a thin topic is swapped, not written up."""
    avoid = []
    for n in range(attempts):
        notes, pages = research(client, category, titles, today, avoid)
        print(f"  topic: {topic_of(notes)} (product pages read: {pages})")
        if pages >= 2:
            return notes
        avoid.append(topic_of(notes))
    raise RuntimeError("could not read enough product pages for any topic")


def write(client, category, notes, today):
    user = (f"Research notes:\n\n{notes}\n\n---\nCategory: {category}. Today is {today}.\n\n"
            "Write the article now as JSON. Leave `items` empty except on the list block, `label` empty except on the callout, "
            "and `content` empty on the products block.")
    msg = stream(client, model=MODEL, max_tokens=20000,
                 system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
                 messages=[{"role": "user", "content": user}],
                 output_config={"format": {"type": "json_schema", "schema": SCHEMA}})
    return json_out(msg, "article")


def as_text(art):
    lines = [f"Title: {art['title']}", f"Subtitle: {art['subtitle']}", f"Excerpt: {art['excerpt']}", ""]
    for b in art["sections"]:
        if b["type"] == "list":
            lines += [f"  • {i}" for i in b["items"]]
        elif b["type"] == "callout":
            lines.append(f"[{b['label']}] {b['content']}")
        elif b["type"] in ("heading", "subheading"):
            lines.append(f"## {b['content']}")
        elif b["type"] == "products":
            lines.append("[PRODUCT CARDS]")
            lines += [f"  * {p['name']} by {p['maker']} | {p['price']} | {p['url']} | {p['blurb']}" for p in art.get("products", [])]
        else:
            lines.append(b["content"])
    return "\n".join(lines)


def edit(client, art, notes):
    user = ("You are the fact-checking editor. Check this draft against the research notes and answer as JSON.\n\n"
            "Checks: every product name, maker, price, fee, feature and URL is traceable to the notes (URLs character for character; prices "
            "exactly as the notes give them, with the month, or 'check current price'); every other number, name, date and quote is in the "
            "notes (quotes verbatim); nothing claims or implies hands-on testing or invents customers, ratings, stock or deadlines; the limits of "
            "the gadget are stated honestly and nothing is oversold (no smart speaker presented as a monitored alert, no hearing or health "
            "claims beyond the sources); health devices point readers to their doctor or audiologist where relevant; no hype words, fake "
            "urgency, ALL CAPS or emoji; title and excerpt do not overstate; nothing reads as copied from a source; no narration of the "
            "research process; no blog, Substack or social-media sources; American English; it is genuinely useful to a reader aged 60 to 85. "
            "verdict: approve if it can run as is, revise if specific fixes are needed, reject if the products cannot be verified from the notes "
            "or the topic is too weak or risky to publish.\n\n"
            f"=== NOTES ===\n{notes}\n\n=== DRAFT ===\n{as_text(art)}")
    msg = stream(client, model=EDITOR_MODEL, max_tokens=4000, messages=[{"role": "user", "content": user}],
                 output_config={"format": {"type": "json_schema", "schema": EDITOR_SCHEMA}})
    if msg.stop_reason != "end_turn":
        return {"verdict": "revise", "notes": f"editor pass did not complete ({msg.stop_reason})", "issues": []}
    return json_out(msg, "editor verdict")


def revise(client, art, verdict, notes):
    issues = "\n- ".join(verdict.get("issues") or [verdict.get("notes", "")])
    user = ("Revise this draft to resolve every issue the editor raised. Fix by removing, softening, qualifying or re-attributing; do not add any "
            "fact, number, price, product or quote that is not in the draft or the research notes (a product that cannot be verified is dropped); "
            "keep the voice, length and block structure. Return JSON.\n\n"
            f"=== EDITOR ISSUES ===\n- {issues}\n\n=== RESEARCH NOTES ===\n{notes}\n\n=== DRAFT (JSON) ===\n"
            + json.dumps({k: art[k] for k in ("title", "subtitle", "excerpt", "sections", "products")}, ensure_ascii=False))
    msg = stream(client, model=EDITOR_MODEL, max_tokens=20000, system=SYSTEM, messages=[{"role": "user", "content": user}],
                 output_config={"format": {"type": "json_schema", "schema": REVISE_SCHEMA}})
    fixed = json_out(msg, "revision")
    out = dict(art)
    out.update({k: fixed[k] for k in ("title", "subtitle", "excerpt", "sections", "products")})
    print("  revised:\n    - " + "\n    - ".join(fixed.get("changes") or ["(no change list)"]))
    return out


def check_products(art, notes):
    """Drop products whose URL is not in the notes (the model must not make up links); the guide needs at least two left."""
    kept = []
    for p in art.get("products", []):
        url = p.get("url", "").strip()
        if url.startswith("https://") and url.rstrip("/") in notes:
            kept.append(p)
        else:
            print(f"  dropped product with a link not in the notes: {p.get('name')} {url}")
    if len(kept) < 2:
        raise RuntimeError(f"only {len(kept)} product(s) with a link from the notes")
    art["products"] = kept
    return art


# ─── output ───────────────────────────────────────────────────

def clean_sections(blocks):
    out = []
    for b in blocks:
        t = b["type"]
        if t == "list":
            items = [i.strip() for i in b.get("items", []) if i.strip()]
            if items:
                out.append({"type": "list", "items": items})
        elif t == "products":
            if not any(x["type"] == "products" for x in out):
                out.append({"type": "products"})
        elif (b.get("content") or "").strip():
            block = {"type": t, "content": b["content"].strip()}
            if t == "callout" and b.get("label"):
                block["label"] = b["label"].strip()
            out.append(block)
    return out


def unique_slug(raw, taken):
    slug = re.sub(r"-+", "-", re.sub(r"[^a-z0-9-]", "", raw.lower().replace(" ", "-"))).strip("-")[:70] or "article"
    base, n = slug, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    return slug


def cover_image(art, slug, now, no_image):
    if no_image:
        return FALLBACK_IMAGE
    rel = pathlib.Path(f"{now:%Y}") / f"{now:%m}" / f"{slug}.jpg"
    try:
        from make_art import generate
        generate(art["image_scene"], UPLOADS / rel)
        return f"/uploads/{rel.as_posix()}"
    except Exception as exc:  # noqa: BLE001
        print(f"  image generation failed ({exc}); using the fallback cover")
        return FALLBACK_IMAGE


def save(art, category, slug, image, now):
    sections = clean_sections(art["sections"])
    words = sum(len((b.get("content") or " ".join(b.get("items", []))).split()) for b in sections)
    record = {
        "id": f"p-{slug}", "slug": slug, "category": category,
        "title": art["title"].strip(), "subtitle": art["subtitle"].strip(), "excerpt": art["excerpt"].strip(),
        "author": AUTHOR, "authorRole": AUTHOR_ROLE,
        "date": f"{now:%B} {now.day}, {now:%Y}", "publishedAt": now.astimezone(dt.timezone.utc).isoformat(timespec="seconds"),
        "readTime": f"{max(3, round(words / 220))} min read", "image": image,
        "tags": [t.strip() for t in art["tags"] if t.strip()][:5], "sections": sections,
        "products": [{k: p[k].strip() for k in ("name", "maker", "price", "url", "blurb")} for p in art["products"]][:4],
        "sources": [s for s in art["sources"] if s.get("url", "").startswith("http") and not re.search(r"pending|unverified", s.get("label", ""), re.I)][:6],
        "relatedIds": [],
    }
    ARTICLES.mkdir(parents=True, exist_ok=True)
    (ARTICLES / f"{slug}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    return record


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--daily", type=int, help="top today's (Pacific) batch up to this many; overrides --count")
    ap.add_argument("--category", choices=CATEGORIES)
    ap.add_argument("--no-image", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    rows = existing()
    count = a.count
    if a.daily is not None:
        done = written_today(rows)
        count = max(0, a.daily - done)
        print(f"{done} article(s) already written today (Pacific); {count} to go")
    if count == 0:
        return
    cats = pick_categories(count, rows, a.category)
    print("categories:", ", ".join(cats))
    if a.dry_run:
        return

    import anthropic
    client = anthropic.Anthropic()
    titles = [r[0] for r in rows]
    taken = {r[1] for r in rows}
    written, failed = [], 0
    for cat in cats:
        now = dt.datetime.now(TZ)
        today = f"{now:%B} {now.day}, {now:%Y}"
        print(f"\n== {cat}")
        try:
            notes = research_solid(client, cat, titles, today)
            art = write(client, cat, notes, today)
            art["category"] = cat
            check_products(art, notes)
            dup = too_similar(art["title"], titles)
            if dup:
                raise RuntimeError(f"too close to an existing article: {dup!r}")
            verdict = edit(client, art, notes)
            print(f"  editor: {verdict['verdict']} — {verdict['notes'][:200]}")
            if verdict["verdict"] == "reject":
                raise RuntimeError("editor rejected the draft")
            if verdict["verdict"] == "revise":
                art = check_products(revise(client, art, verdict, notes), notes)
            slug = unique_slug(art["slug"], taken)
            image = cover_image(art, slug, now, a.no_image)
            rec = save(art, cat, slug, image, now)
            titles.append(rec["title"])
            taken.add(slug)
            written.append(rec)
            print(f"  saved '{rec['title']}' -> /articles/{slug}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            traceback.print_exc()
            print(f"  FAILED: {exc.__class__.__name__}: {str(exc)[:300]}")
    print(f"\ndone: {len(written)} written, {failed} failed; {USAGE['calls']} API calls, estimated cost ${USAGE['cost']:.2f}")
    if not written and failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
