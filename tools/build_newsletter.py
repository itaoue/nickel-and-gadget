#!/usr/bin/env python3
"""
Build the Nickel And Gadget daily email from the site's own gadget guides.

Layout (the Ascend Wellness daily, in blue): a "Please Read or Unsubscribe" line; a two-tone
NICKEL & | GADGET wordmark; TODAY'S GADGET GUIDE: one guide as a left-ruled headline with a blue teaser line,
its cover image, the products it covers with their published prices, and a large "See the Guide >>" link;
a SPONSORED native ad (content/newsletter/config.json); MORE GUIDES: left-ruled headlines with teasers; a
second sponsored ad; a grey editor box; a DISCLOSURE block; and the postal footer with *|UNSUB|*.

    python3 tools/build_newsletter.py content/newsletter/2026-10-28.json   # hand-written issue file
    python3 tools/build_newsletter.py --auto                                 # tomorrow's issue from the newest articles
    python3 tools/build_newsletter.py --auto --skip-if-exists --min-today 3  # scheduled run, after the day's articles

The issue file names the stories and the copy that is not on the site:
    {"date": "2026-10-28", "subject": "...", "preheader": "...",
     "featured": {"slug": "...", "teaser": "..."},
     "recent": [{"slug": "...", "teaser": "..."}, ...],
     "poll": {"question": "...", "options": ["...", "..."]}}          # optional: TODAY'S POLL after the guide
A poll is also written to client/public/polls/<date>.json, which the site's server reads to count votes
(/poll/<date>/vote/<n>?c=*|_ID|*) and to show results at /poll/<date>.
Headlines and images come from the site's articles (seed file + daily pipeline files). With --auto the
issue file is written for you: the newest articles fill FEATURED and RECENT, and Claude (EDITOR_MODEL,
when ANTHROPIC_API_KEY is set) picks the lead and writes the subject, preheader, teaser lines and a poll about
the lead; without a key the article titles and subtitles and a generic poll are used.

Output: dist/newsletters/<date>.html, .txt and .json (for tools/push_newsletter.py), and a copy of the HTML in client/public/newsletters/
so the "View online" link works once committed and deployed.
"""
import argparse
import datetime as dt
import html
import json
import os
import pathlib
import re
import sys
import zoneinfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://www.nickelandgadget.com"
CONTENT = ROOT / "client" / "src" / "content"
ALL = json.loads((CONTENT / "seed-articles.json").read_text()) + [json.loads(f.read_text()) for f in sorted((CONTENT / "articles").glob("*.json"))]
ARTICLES = {a["slug"]: a for a in ALL}
ISSUES = ROOT / "content" / "newsletter"
PT = zoneinfo.ZoneInfo("America/Los_Angeles")
OUT = ROOT / "dist" / "newsletters"
STATIC = ROOT / "client" / "public" / "newsletters"
POLLS = ROOT / "client" / "public" / "polls"   # served at /polls/<date>.json; the site's server reads the question from there
CONTACT_TAG = "*|_ID|*"   # BigMailer fills in the contact id, so each subscriber has one vote (last click wins)

BLUE, INK, GREY, LABEL, BOX, LINK, COPPER = "#1f6fb2", "#2a2a2a", "#656565", "#9fa2a7", "#efefef", "#0b57d0", "#c06b1c"
CONFIG = json.loads((ISSUES / "config.json").read_text())
FONT = "'Open Sans',Arial,sans-serif"
ADDRESS = "499 Evernia Street, Apt 303<br>West Palm Beach, FL 33401"


def esc(s):
    return html.escape(s or "", quote=True)


def url(slug, issue, n):
    return f"{SITE}/articles/{slug}?utm_source=newsletter&utm_medium=email&utm_campaign=nag-daily-{issue}&utm_content={n}"


def img_src(a):
    return a["image"] if a["image"].startswith("http") else SITE + a["image"]


def headline(a, teaser, href):
    return f"""<tr><td style="border-left:3px solid {BLUE};font-family:{FONT};font-size:20px;line-height:27px;padding-left:10px;">
<a href="{esc(href)}" target="_blank" style="color:{INK};font-size:20px;text-decoration:none;"><span style="font-weight:600;">{esc(a['title'])}</span><br>
<span style="color:{LINK};">{esc(teaser)}&nbsp;&gt;&gt;</span></a></td></tr>
<tr><td height="18" style="font-size:18px;line-height:18px;">&nbsp;</td></tr>"""


def products_box(a, href):
    """The guide's products with the sellers' published prices; every line links to the guide, not the seller."""
    rows = "".join(f"""<tr><td style="font-family:{FONT};font-size:16px;line-height:24px;padding:6px 0;border-bottom:1px solid #e3e6ea;">
<a href="{esc(href)}" target="_blank" style="color:{INK};text-decoration:none;"><span style="font-weight:600;">{esc(p['name'] if p['maker'].lower() in p['name'].lower() else p['maker'] + ' ' + p['name'])}</span>
<span style="color:{COPPER};">&nbsp;&middot;&nbsp;{esc(p['price'])}</span></a></td></tr>""" for p in a.get("products", [])[:4])
    if not rows:
        return ""
    return f"""<tr><td style="padding:4px 12px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="color:{LABEL};font-family:{FONT};font-size:12px;font-weight:600;letter-spacing:3px;padding-bottom:4px;">IN THIS GUIDE</td></tr>
{rows}</table></td></tr>"""


def pick_sponsors(date):
    """{slot: banner} for this issue: pinned by overrides, else rotated by date with a different group in each slot when possible."""
    sp = CONFIG.get("sponsors", {})
    if not sp.get("enabled"):
        return {}
    active = [b for b in sp["banners"] if b.get("active") and b.get("headline")]
    by_name = {b["name"]: b for b in active}
    pinned = sp.get("overrides", {}).get(date, {})
    day = dt.date.fromisoformat(date).toordinal()
    groups = sorted({b["group"] for b in active})
    out, used = {}, set()
    for i, slot in enumerate(sp["slots"]):
        if pinned.get(slot) in by_name:
            out[slot] = by_name[pinned[slot]]
        else:
            free = [g for g in groups if g not in used] or groups
            if not free:
                break
            group = free[(day + i) % len(free)]
            pool = [b for b in active if b["group"] == group]
            out[slot] = pool[day % len(pool)]  # a different creative each day
        used.add(out[slot]["group"])
    return out


def sponsor_url(b, date, slot):
    return b["url"].replace("{campaign}", date).replace("{slot}", slot).replace("{banner}", b["name"])


def sponsor_block(b, date, slot):
    href = esc(sponsor_url(b, date, slot))
    adv = f"{esc(b['advertiser'])} | Sponsored" if b.get("advertiser") else "Sponsored"
    return f"""{label(CONFIG["sponsors"].get("label", "SPONSORED"))}
<tr><td style="padding:0 7px;"><a href="{href}" target="_blank" style="text-decoration:none;color:{INK};">
<img src="{esc(SITE + b['image'])}" alt="{esc(b['headline'])}" width="576" style="width:100%;max-width:576px;height:auto;display:block;margin:0 auto;border:0;"></a></td></tr>
<tr><td style="font-family:{FONT};padding:10px 10px 0;"><a href="{href}" target="_blank" style="text-decoration:none;color:{INK};font-size:19px;line-height:26px;font-weight:600;">{esc(b['headline'])}</a></td></tr>
<tr><td style="font-family:{FONT};padding:6px 10px 0;font-size:13px;color:{GREY};">{adv}</td></tr>
<tr><td style="padding:12px 10px 0;"><a href="{href}" target="_blank" style="display:inline-block;background:{BLUE};color:#ffffff;font-family:{FONT};font-size:15px;font-weight:700;text-decoration:none;padding:10px 26px;border-radius:22px;">{esc(b.get('cta') or 'Learn More')}</a></td></tr>
<tr><td height="28" style="font-size:28px;line-height:28px;">&nbsp;</td></tr>"""


def label(text):
    return f"""<tr><td style="color:{LABEL};font-family:{FONT};font-size:13px;font-weight:600;letter-spacing:4px;padding-left:10px;">{text}</td></tr>
<tr><td height="15" style="font-size:15px;line-height:15px;">&nbsp;</td></tr>"""


def vote_url(d, i):
    return f"{SITE}/poll/{d}/vote/{i}?c={CONTACT_TAG}&utm_source=newsletter&utm_medium=email&utm_campaign=nag-daily-{d}&utm_content=poll"


def poll_block(issue):
    poll = issue.get("poll")
    if not poll:
        return ""
    d = issue["date"]
    buttons = "".join(
        f"""<tr><td style="padding:5px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" style="border:2px solid {BLUE};border-radius:6px;padding:11px 14px;">
<a href="{esc(vote_url(d, i))}" target="_blank" style="display:block;font-family:{FONT};font-size:17px;font-weight:600;color:{BLUE};text-decoration:none;">{esc(o)}</a>
</td></tr></table></td></tr>"""
        for i, o in enumerate(poll["options"]))
    return f"""{label("TODAY&#8217;S POLL")}
<tr><td style="border-left:3px solid {BLUE};font-family:{FONT};font-size:20px;line-height:27px;font-weight:600;color:{INK};padding-left:10px;">{esc(poll['question'])}</td></tr>
<tr><td height="8" style="font-size:8px;line-height:8px;">&nbsp;</td></tr>
{buttons}
<tr><td style="padding:8px 10px 0;font-family:{FONT};font-size:13px;color:{GREY};">Tap an answer to vote. <a href="{SITE}/poll/{d}" target="_blank" style="color:{LINK};">See the results so far&nbsp;&gt;&gt;</a></td></tr>
<tr><td height="28" style="font-size:28px;line-height:28px;">&nbsp;</td></tr>"""


def build(issue):
    d = issue["date"]
    feat = ARTICLES[issue["featured"]["slug"]]
    furl = url(feat["slug"], d, "featured")
    recent = [(ARTICLES[r["slug"]], r["teaser"]) for r in issue["recent"]]
    rows = "".join(headline(a, t, url(a["slug"], d, f"recent-{i}")) for i, (a, t) in enumerate(recent, 1))
    ads = pick_sponsors(d)
    top = sponsor_block(ads["top"], d, "top") if "top" in ads else ""
    mid = sponsor_block(ads["mid"], d, "mid") if "mid" in ads else ""
    pre = esc(issue["preheader"]) + "&nbsp;&#847;" * 60
    page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(issue['subject'])}</title>
<style>@media only screen and (max-width:480px){{.feat-img{{width:100% !important}}}}</style></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;">{pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;table-layout:fixed;">
<tr><td align="center" style="padding:0 5px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:590px;min-width:250px;">
<tr><td align="center" style="font-family:Arial,sans-serif;padding:3px;font-size:13px;color:#999999;">Please Read or <a href="*|UNSUB|*" style="color:#999999;">Unsubscribe</a></td></tr>
<tr><td align="center" style="padding-top:6px;"><a href="{SITE}/?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=nag-daily-{d}&amp;utm_content=logo" target="_blank" style="text-decoration:none;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="right" style="font-family:{FONT};padding:3px 0;color:{BLUE};font-size:17px;font-weight:400;letter-spacing:2px;">&nbsp; NICKEL &amp; &nbsp;</td>
<td align="left" bgcolor="{BLUE}" style="font-family:{FONT};padding:3px 0;color:#ffffff;font-size:17px;font-weight:400;letter-spacing:2px;">&nbsp; GADGET &nbsp;</td>
</tr></table></a></td></tr>
<tr><td height="22" style="font-size:22px;line-height:22px;">&nbsp;</td></tr>
{label("TODAY&#8217;S GADGET GUIDE")}
<tr><td style="border-left:3px solid {BLUE};font-family:{FONT};font-size:20px;line-height:27px;padding-left:10px;">
<a href="{esc(furl)}" target="_blank" style="color:{INK};font-size:20px;text-decoration:none;"><span style="font-weight:600;">{esc(feat['title'])}</span><br>
<span style="color:{LINK};">{esc(issue['featured']['teaser'])}&nbsp;&gt;&gt;</span></a></td></tr>
<tr><td align="center" style="font-family:{FONT};font-size:17px;line-height:27px;padding:7px;">
<a href="{esc(furl)}" target="_blank" style="color:{GREY};text-decoration:none;"><img class="feat-img" src="{esc(img_src(feat))}" alt="{esc(feat['title'])}" width="576" style="width:100%;max-width:576px;height:auto;display:block;margin:7px auto;border:0;"></a></td></tr>
{products_box(feat, furl)}
<tr><td align="center" style="font-family:{FONT};padding:16px 7px 0;"><a href="{esc(furl)}" target="_blank" style="font-size:24px;font-weight:700;color:{LINK};text-decoration:none;">See&nbsp;the&nbsp;Guide&nbsp;&gt;&gt;</a></td></tr>
<tr><td height="30" style="font-size:30px;line-height:30px;">&nbsp;</td></tr>
{poll_block(issue)}
{top}
{label("MORE GUIDES")}
{rows}
<tr><td height="10" style="font-size:10px;line-height:10px;">&nbsp;</td></tr>
{mid}
<tr><td height="10" style="font-size:10px;line-height:10px;">&nbsp;</td></tr>
<tr><td style="background-color:{BOX};border-radius:7px;color:{GREY};font-family:{FONT};font-size:16px;line-height:30px;padding:35px 22px;" align="center">
<a href="{SITE}/?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=nag-daily-{d}&amp;utm_content=editor" target="_blank" style="font-size:20px;color:{GREY};letter-spacing:3px;line-height:40px;text-decoration:none;">NICKEL AND GADGET</a><br>
Technology should make life easier, not more confusing. Every day we explain one useful, easy-to-use gadget in plain English: what it does, who it suits and what it&nbsp;costs.<br>
<span style="font-family:Georgia,serif;font-size:18px;line-height:36px;font-style:italic;">The Nickel And Gadget Editors</span><br>
<span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;">Editors</span></td></tr>
<tr><td height="10" style="font-size:10px;line-height:10px;">&nbsp;</td></tr>
<tr><td style="color:{GREY};font-family:{FONT};font-size:16px;line-height:30px;padding:12px;"><span style="font-size:13px;font-weight:bold;letter-spacing:3px;">DISCLOSURE</span><br>
Use of this email and of nickelandgadget.com is subject to the Privacy Policy and Terms &amp; Conditions published on our website. Some links in this email are affiliate or sponsored links: if you buy through them we may earn a commission at no extra cost to you. Ads are labeled Sponsored. Prices are the sellers&#8217; published prices on the date of each guide and can change; we have not tested products hands-on. Nothing here is medical advice.</td></tr>
<tr><td align="center" style="color:{INK};font-family:{FONT};font-size:14px;line-height:22px;padding:35px 22px;">
Nickel And Gadget<br>{ADDRESS}<br>
<a href="{SITE}/newsletters/{d}.html" style="color:{INK};">View online</a> &nbsp;|&nbsp; <a href="*|UNSUB|*" style="color:{INK};">Unsubscribe</a><br><br>
&copy; Copyright nickelandgadget.com. All Rights Reserved.</td></tr>
</table></td></tr></table></body></html>
"""
    text = [issue["preheader"], "", "TODAY'S GADGET GUIDE", feat["title"], issue["featured"]["teaser"] + " >>"]
    text += [f"- {p['name']}: {p['price']}" for p in feat.get("products", [])[:4]]
    text += [furl, ""]
    if issue.get("poll"):
        text += ["TODAY'S POLL: " + issue["poll"]["question"], *(f"- {o}: {vote_url(d, i)}" for i, o in enumerate(issue["poll"]["options"])), ""]
    if "top" in ads:
        text += ["SPONSORED: " + ads["top"]["headline"], sponsor_url(ads["top"], d, "top"), ""]
    text += ["MORE GUIDES"]
    for i, (a, t) in enumerate(recent, 1):
        text += [a["title"], t + " >>", url(a["slug"], d, f"recent-{i}"), ""]
    if "mid" in ads:
        text += ["SPONSORED: " + ads["mid"]["headline"], sponsor_url(ads["mid"], d, "mid"), ""]
    text += ["Some links are affiliate or sponsored links; we may earn a commission at no extra cost to you.", "",
             "Nickel And Gadget, 499 Evernia Street, Apt 303, West Palm Beach, FL 33401", "Unsubscribe: *|UNSUB|*"]
    return page, "\n".join(text)


def published(a):
    if a.get("publishedAt"):
        return dt.datetime.fromisoformat(a["publishedAt"])
    return dt.datetime.strptime(a["date"], "%B %d, %Y").replace(tzinfo=PT)


COPY_RULES = """You write the subject line and teasers for the Nickel And Gadget daily email: plain-English guides to senior-friendly
gadgets for readers aged 60 to 85 and the adult children who shop for them. Pick the guide with the strongest everyday pull for that
reader as the lead (safety, staying in touch with family, hearing and seeing better, easier chores, good gifts). Subject: 35 to 65
characters, reader-focused (you/your) with a curiosity gap, built on a real fact, price or promise from that guide, never a claim the
guide does not make; no product-review or study labels. Preheader: under 90 characters, a second hook from the same guide. Teasers: one
short line each (under 60 characters, no trailing punctuation), in the style "The free setting that makes any iPhone easier to read" or
"What fall detection can and can't catch".
No "game-changer", "must-have", "miracle", no fake urgency or scarcity, no ALL CAPS, no emoji. American English."""
COPY_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["lead_slug", "subject", "preheader", "teasers"],
    "properties": {
        "lead_slug": {"type": "string"}, "subject": {"type": "string"}, "preheader": {"type": "string"},
        "teasers": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["slug", "teaser"],
                                               "properties": {"slug": {"type": "string"}, "teaser": {"type": "string"}}}},
    },
}


def plain(a, limit=1200):
    text = " ".join(b.get("content") or " ".join(b.get("items", [])) for b in a.get("sections", []))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def short(text, limit=80):
    """First sentence, cut at a word boundary."""
    text = re.split(r"(?<=[.!?])\s", text.strip(), maxsplit=1)[0].rstrip(".")
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def write_copy(picks):
    """Lead, subject, preheader and teasers by Claude; titles and subtitles if there is no key or the call fails."""
    fallback = {"lead_slug": picks[0]["slug"], "subject": picks[0]["title"], "preheader": short(picks[0]["subtitle"], 110),
                "teasers": {a["slug"]: short(a["subtitle"]) for a in picks}}
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return fallback
    try:
        import anthropic
        stories = "\n\n".join(f"slug: {a['slug']}\ntitle: {a['title']}\nsubtitle: {a['subtitle']}\ntext: {plain(a)}" for a in picks)
        msg = anthropic.Anthropic(max_retries=3).messages.create(
            model=os.environ.get("EDITOR_MODEL", "claude-sonnet-5-5"), max_tokens=1500, system=COPY_RULES,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": COPY_SCHEMA}},
            messages=[{"role": "user", "content": f"Today's stories:\n\n{stories}\n\nWrite the copy as JSON, one teaser per story."}])
        data = json.loads(next(b.text for b in msg.content if b.type == "text"))
        slugs = {a["slug"] for a in picks}
        teasers = {t["slug"]: t["teaser"].strip().rstrip(".>") for t in data["teasers"] if t["slug"] in slugs and t["teaser"].strip()}
        if data["lead_slug"] not in slugs or not data["subject"].strip():
            raise ValueError("copy did not name one of the stories as the lead")
        return {"lead_slug": data["lead_slug"], "subject": data["subject"].strip(), "preheader": data["preheader"].strip(),
                "teasers": {**fallback["teasers"], **teasers}}
    except Exception as exc:  # noqa: BLE001 - never block the issue on the copy
        print(f"copy generation failed ({exc}); using titles and subtitles")
        return fallback


POLL_RULES = """Write ONE reader-poll question for the Nickel And Gadget daily email (senior-friendly gadgets, readers aged 60 to 85
and the adult children who shop for them), about the specific guide below.
- Ask about the reader's own experience, habit, plan or opinion on the topic of THIS guide (e.g. 'How do you know who's at your door
  before you open it?', 'Do you use captions when you watch TV?', 'What would you pay for a phone that's easier to use?'). Specific
  to the guide, never generic ('Do you like gadgets?').
- Under 16 words, plain and friendly. Never ask about diagnoses, medications, money they have, or anything a reader would find too
  personal; never imply a product recommendation.
- 3 or 4 answer options, each under 6 words, covering the realistic range; include a 'Not sure' or 'Don't use one' style option
  when it fits.
Return JSON with question and options."""
POLL_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["question", "options"],
               "properties": {"question": {"type": "string"}, "options": {"type": "array", "items": {"type": "string"}}}}


def poll_question(lead):
    """Claude writes the question about the lead guide; without a key, a simple question about its topic."""
    fallback = {"question": "Would a gadget like the ones in today's guide make your day easier?", "options": ["Yes, probably", "Maybe", "No", "I already have one"]}
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return fallback
    try:
        import anthropic
        msg = anthropic.Anthropic(max_retries=3).messages.create(
            model=os.environ.get("EDITOR_MODEL", "claude-sonnet-5-5"), max_tokens=300, system=POLL_RULES,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": POLL_SCHEMA}},
            messages=[{"role": "user", "content": f"Title: {lead['title']}\nSummary: {lead['excerpt']}\nText: {plain(lead, 1500)}"}])
        data = json.loads(next(b.text for b in msg.content if b.type == "text"))
        opts = [o.strip()[:60] for o in data.get("options", []) if o.strip()][:4]
        if data.get("question") and len(opts) >= 2:
            return {"question": data["question"].strip()[:200], "options": opts}
    except Exception as exc:  # noqa: BLE001 - never block the issue on the poll
        print(f"poll question generation failed ({exc}); using the fallback question")
    return fallback


def auto_issue(date, recent_count=4):
    """Issue file for `date` from the newest articles, skipping every story the previous issue carried (topped up if short)."""
    newest = sorted(ALL, key=published, reverse=True)
    prev = sorted(p for p in ISSUES.glob("*.json") if p.stem < date)
    sent = set()
    if prev:
        last = json.loads(prev[-1].read_text())
        sent = {last["featured"]["slug"], *(r["slug"] for r in last["recent"])}
    picks = ([a for a in newest if a["slug"] not in sent] + [a for a in newest if a["slug"] in sent])[: recent_count + 1]
    copy = write_copy(picks)
    lead = next(a for a in picks if a["slug"] == copy["lead_slug"])
    rest = [a for a in picks if a is not lead]
    return {"date": date, "subject": copy["subject"], "preheader": copy["preheader"],
            "featured": {"slug": lead["slug"], "teaser": copy["teasers"][lead["slug"]]},
            "recent": [{"slug": a["slug"], "teaser": copy["teasers"][a["slug"]]} for a in rest],
            "poll": poll_question(lead)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("issue", nargs="?", help="issue file, e.g. content/newsletter/2026-10-28.json")
    ap.add_argument("--auto", action="store_true", help="write the issue file from the newest articles, then build it")
    ap.add_argument("--date", help="issue date YYYY-MM-DD for --auto (default: tomorrow, Pacific; the issue goes out the next morning)")
    ap.add_argument("--skip-if-exists", action="store_true", help="--auto: do nothing if this date's issue already exists")
    ap.add_argument("--min-today", type=int, default=0, help="--auto: skip unless this many articles were published today (Pacific)")
    a = ap.parse_args()
    if a.auto:
        # built after the day's articles, read the next morning
        date = a.date or (dt.datetime.now(PT).date() + dt.timedelta(days=1)).isoformat()
        path = ISSUES / f"{date}.json"
        if a.skip_if_exists and path.exists():
            print(f"{date}: issue already exists, skipping")
            return
        today = dt.datetime.now(PT).date()
        done = sum(1 for x in ALL if x["id"].startswith("p-") and published(x).astimezone(PT).date() == today)  # pipeline articles only
        if done < a.min_today:
            print(f"{date}: today's article batch is not finished ({done} < {a.min_today}), skipping")
            return
        issue = auto_issue(date)
        ISSUES.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(issue, ensure_ascii=False, indent=2) + "\n")
    elif a.issue:
        issue = json.loads(pathlib.Path(a.issue).read_text())
    else:
        sys.exit("give an issue file or --auto")
    page, text = build(issue)
    OUT.mkdir(parents=True, exist_ok=True)
    STATIC.mkdir(parents=True, exist_ok=True)
    d = issue["date"]
    (OUT / f"{d}.html").write_text(page)
    (OUT / f"{d}.txt").write_text(text)
    (OUT / f"{d}.json").write_text(json.dumps(issue, ensure_ascii=False, indent=1))
    (STATIC / f"{d}.html").write_text(page.replace("*|UNSUB|*", f"{SITE}/").replace(f"c={CONTACT_TAG}&amp;", ""))
    if issue.get("poll"):
        POLLS.mkdir(parents=True, exist_ok=True)
        (POLLS / f"{d}.json").write_text(json.dumps({"campaign": d, **issue["poll"], "lead": issue["featured"]["slug"]}, ensure_ascii=False, indent=1) + "\n")
        print(f"  poll: {issue['poll']['question']} ({' / '.join(issue['poll']['options'])})")
    print(f"{d}: subject '{issue['subject']}' | preheader '{issue['preheader']}'")
    print(f"  featured: {ARTICLES[issue['featured']['slug']]['title']} -- {issue['featured']['teaser']}")
    for r in issue["recent"]:
        print(f"  recent:   {ARTICLES[r['slug']]['title']} -- {r['teaser']}")
    print(f"wrote dist/newsletters/{d}.html (+ .txt/.json) and client/public/newsletters/{d}.html")


if __name__ == "__main__":
    main()
