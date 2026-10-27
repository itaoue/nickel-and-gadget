#!/usr/bin/env python3
"""
Create the BigMailer draft for a Nickel And Gadget daily built by tools/build_newsletter.py.

    python3 tools/push_newsletter.py 2026-10-28            # draft named "NAG Daily 10/28 | <subject>"
    python3 tools/push_newsletter.py 2026-10-28 --dry-run

The draft has no recipients unless NAG_NEWSLETTER_LIST_IDS (comma-separated list ids) is set: lists are
picked in BigMailer before sending, so the daily never collides with the warm-up sends.
Environment: BIGMAILER_API_KEY; BIGMAILER_BRAND_ID (default: the Nickel And Gadget brand).
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import sys

import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
BM = "https://api.bigmailer.io/v1"
BRAND = os.environ.get("BIGMAILER_BRAND_ID") or "9d22c1e6-0bdb-4728-9fc7-4ab6316e7d0f"
FROM = {"name": "Nickel And Gadget", "email": "news@email.nickelandgadget.com"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("date", help="issue date YYYY-MM-DD (from dist/newsletters)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    key = os.environ.get("BIGMAILER_API_KEY") or sys.exit("Set BIGMAILER_API_KEY first.")
    headers = {"X-API-Key": key, "content-type": "application/json"}
    base = ROOT / "dist" / "newsletters" / a.date
    issue = json.loads(base.with_suffix(".json").read_text())
    name = f"NAG Daily {dt.date.fromisoformat(a.date):%m/%d} | {issue['subject']}"[:50]  # BigMailer caps names at 50 chars
    existing = requests.get(f"{BM}/brands/{BRAND}/bulk-campaigns?limit=100", headers=headers, timeout=30).json().get("data", [])
    if any(c.get("name") == name for c in existing):
        print(f"draft '{name}' already exists; nothing created")
        return
    lists = [x.strip() for x in os.environ.get("NAG_NEWSLETTER_LIST_IDS", "").split(",") if x.strip()]
    payload = {"name": name, "subject": issue["subject"], "preview": issue["preheader"], "from": FROM, "reply_to": FROM,
               "html": base.with_suffix(".html").read_text(), "text": base.with_suffix(".txt").read_text(),
               "list_ids": lists, "track_opens": True, "track_clicks": True}
    print(f"'{name}' | subject '{issue['subject']}' | {len(lists)} list(s)")
    if a.dry_run:
        print("dry run: nothing created")
        return
    r = requests.post(f"{BM}/brands/{BRAND}/bulk-campaigns", headers=headers, json=payload, timeout=60)
    if r.status_code >= 300:
        sys.exit(f"BigMailer error {r.status_code}: {r.text[:400]}")
    print(f"draft created: {r.json().get('id')}")


if __name__ == "__main__":
    main()
