# Prospect Project Homie — Web App

Interactive Next.js search for qualified PPP prospects near closing Comerica/Fifth Third branches.

## Features

- Full-text search across businesses, addresses, NAICS codes, contacts, and notes
- Filters for ZIP code, closing branch, minimum loan, distance, and contact availability
- Sortable prospect results
- Expandable source and verification notes
- Export the current filtered list to CSV
- Responsive desktop/mobile interface
- Business-specific public discovery links for official web, X, Instagram, Facebook, Google News, GDELT, Michigan LARA, and local chambers
- Explainable $150k qualification view that keeps revenue unverified until reviewer-confirmed source evidence supports it
- Source-specific evidence freshness and entity-match guidance
- Public-contact verification, suppression/opt-out, human-review, and CAN-SPAM readiness guardrails; no autonomous outreach
- Source-attributed evidence intake for registry findings, official websites, news, social posts, notes, and text-file excerpts
- Browser-local evidence ledger with JSON import/export
- Versioned draft Flagstar product catalog with human-verification flags
- Optional server-side OpenRouter web research with citation validation and human acceptance of each finding
- Optional server-side OpenRouter product comparison that requires evidence citations and validates structured output
- Persistent Neon/Postgres evidence, relationship, closure, business-signal, and suppression records
- Live Michigan ZIP search with nearest sourced closure, explainable ranking, and relative-location map

## Local development

```bash
nvm use
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Persistent intelligence setup

1. Provision Neon Postgres and Clerk through the Vercel Marketplace.
2. Set `PROSPECT_BOOTSTRAP_INVITE_CODE` to a private one-time owner code.
3. Run `npm run db:migrate`, then `npm run db:seed` with `DATABASE_URL` available.
4. Sign up, redeem the bootstrap code once, and create member invitations at `/admin/invites`.
5. Keep `PROSPECT_APP_ACCESS_CODE` only while migrating existing access, then remove it.
6. Review `.env.example` before using any explicit public-data discovery script.

The static explorer continues to build without a database. Live ZIP search returns a clear unavailable response until the database is configured; it never silently falls back to ephemeral filesystem writes.

## Verification

```bash
npm run verify
```

This validates prospect data and the product/evidence knowledge layer, then runs ESLint, TypeScript checks, and the production build.

## Updating data

The canonical generated JSON file lives one directory above the app:

```bash
npm run sync-data
```

This copies `../PPP-Prospect-Results.json` into `src/data/prospects.json` for the statically generated page. Run `npm run check-data` to verify that the bundled copy matches the canonical file.

## Deployment

Recommended: import the repository into Vercel and set the root directory to `prospect-app`.

- Framework preset: Next.js
- Node.js version: 24.x
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave blank (the committed `vercel.json` clears stale overrides)
- Environment variables: see `.env.example`; `DATABASE_URL` is required for live intelligence and persistent records

The browser evidence workspace still supports local JSON import/export. Authenticated evidence, contact, feedback, outreach, suppression, business, branch, relationship, and signal APIs persist in Postgres for multi-device use.

The optional `/api/research` and `/api/compare` routes require a server-only `OPENROUTER_API_KEY`. In production they also require `PROSPECT_APP_ACCESS_CODE`; the browser sends the code per request, while the OpenRouter key never leaves the server. By default both endpoints mirror the OpenClaw TUI's cost-first model chain: free Nemotron → GPT-5.6 Sol → DeepSeek V4 Pro. OpenRouter only advances when an earlier model errors, is unavailable/rate-limited, or refuses. `OPENROUTER_MODEL_CHAIN` changes both endpoints; `OPENROUTER_RESEARCH_MODELS` and `OPENROUTER_COMPARE_MODELS` can override one endpoint with a comma-separated chain.

Research uses OpenRouter's web-search plugin and rejects findings that do not cite a returned search URL; each finding remains a draft until a reviewer adds it to the ledger. The public discovery links are reviewer-operated launchers, not an Instagram/X/Facebook scraper: do not bypass login controls, robots/rate limits, or platform restrictions. Product comparison validates request size, rate-limits by IP, uses strict structured output, and rejects recommendations without valid evidence citations. OpenRouter web search adds provider/search cost, so keep both the access-code gate and Vercel protection enabled. Do **not** prefix the OpenRouter key with `NEXT_PUBLIC_`.

The prospect dataset and outreach strategy are included in the browser-delivered app, so enable Vercel Deployment Protection if the site should remain private. Route handlers are public endpoints; keep the access-code gate enabled before configuring a cost-bearing API key.

Do not set the Output Directory to `public` or `.next`. Vercel's Next.js adapter packages the framework output automatically; a manual static-output override causes deployment to fail after an otherwise successful build.
