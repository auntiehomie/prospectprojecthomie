# Prospect Project Homie — Web App

Interactive Next.js search for qualified PPP prospects near closing Comerica/Fifth Third branches.

## Features

- Full-text search across businesses, addresses, NAICS codes, contacts, and notes
- Filters for ZIP code, closing branch, minimum loan, distance, and contact availability
- Sortable prospect results
- Expandable source and verification notes
- Export the current filtered list to CSV
- Responsive desktop/mobile interface
- Source-attributed evidence intake for registry findings, official websites, news, social posts, notes, and text-file excerpts
- Browser-local evidence ledger with JSON import/export
- Versioned draft Flagstar product catalog with human-verification flags
- Optional server-side OpenRouter web research with citation validation and human acceptance of each finding
- Optional server-side OpenRouter product comparison that requires evidence citations and validates structured output

## Local development

```bash
nvm use
npm ci
npm run dev
```

Open <http://localhost:3000>.

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
- Node.js version: 22.x
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave blank (the committed `vercel.json` clears stale overrides)
- Environment variables: optional; see `.env.example`

Evidence added through the UI stays in that browser's `localStorage` until it is exported or removed. This is a useful intake foundation, not yet a durable multi-device database.

The optional `/api/research` and `/api/compare` routes require a server-only `OPENROUTER_API_KEY`. In production they also require `PROSPECT_APP_ACCESS_CODE`; the browser sends the code per request, while the OpenRouter key never leaves the server. Research uses OpenRouter's web-search plugin and rejects findings that do not cite a returned search URL; each finding remains a draft until a reviewer adds it to the ledger. Product comparison validates request size, rate-limits by IP, uses strict structured output, and rejects recommendations without valid evidence citations. OpenRouter web search adds provider/search cost, so keep both the access-code gate and Vercel protection enabled. Do **not** prefix the OpenRouter key with `NEXT_PUBLIC_`.

The prospect dataset and outreach strategy are included in the browser-delivered app, so enable Vercel Deployment Protection if the site should remain private. Route handlers are public endpoints; keep the access-code gate enabled before configuring a cost-bearing API key.

Do not set the Output Directory to `public` or `.next`. Vercel's Next.js adapter packages the framework output automatically; a manual static-output override causes deployment to fail after an otherwise successful build.
