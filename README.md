# Nickel And Gadget

nickelandgadget.com: plain-English guides to senior-friendly gadgets, plus a daily email. React + Vite front end,
Express server (`server/index.ts`), deployed on Railway from `main`. Same frame as Ascend Wellness / Upwellness Insider.

## Content

- Guides live as JSON in `client/src/content/articles/` (one file per guide, loaded at build time); covers in
  `client/public/uploads/yyyy/mm/`. A guide has the usual `sections` plus a `products` array (name, maker, price as
  published with its month, product-page url, blurb), rendered as "Check price" cards where the `{"type": "products"}`
  block sits.
- `tools/write_articles.py` writes 3 guides a day (`.github/workflows/content.yml`): research reads real product pages,
  any product whose link is not in the research notes is dropped, and an editor pass checks every price and claim.
- Six categories: Health & Safety, Smart Home, Phones & Tablets, Hearing & Vision, Home & Kitchen, Gift Ideas.

## Daily email

`tools/build_newsletter.py --auto` builds tomorrow's issue from the newest guides (lead guide + its product prices,
two sponsor native ads from `content/newsletter/config.json`, more guides); `tools/push_newsletter.py` creates a
BigMailer draft "NAG Daily MM/DD | subject" in the Nickel And Gadget brand with no lists unless
`NAG_NEWSLETTER_LIST_IDS` is set. Sponsor links always carry `nag` as sub1 / external_id prefix.

## Setup

- GitHub secrets: `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `BIGMAILER_API_KEY`. Optional variables: `NAG_NEWSLETTER_LIST_IDS`,
  `DAILY_ARTICLES`, model overrides.
- Railway variables: `BIGMAILER_API_KEY` (site signups go to the brand's "Website Signups" list), optional
  `VITE_AMAZON_TAG` (adds an Amazon Associates tag to amazon.com product links at build time).
- Local: `pnpm install && pnpm dev` (node lives in `~/.local/node/bin`).

## Old URLs

The previous Wix site's `/about-us` and `/contact-us` redirect to `/about` and `/contact`.
