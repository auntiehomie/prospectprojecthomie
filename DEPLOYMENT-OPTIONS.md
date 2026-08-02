# Interactive deployment options

## Recommendation: Vercel-hosted Next.js app

Use the included `prospect-app` and deploy it from this repository with Vercel.

Why this is the best current fit:

- The workflow needs interactive filtering, sorting, detail review, and CSV export.
- The current dataset is small and historical, so a static JSON-backed app is fast and inexpensive.
- No API keys, database, or server process are required for the read-only version.
- Vercel preview deployments make review easy before production changes.
- A later authenticated CRM/outreach layer can be added without replacing the search interface.

Vercel configuration:

- Framework preset: Next.js
- Root directory: `prospect-app`
- Build command: `npm run build`
- Install command: `npm ci`
- Output: Next.js default

## Notion dashboard

Notion is useful as a secondary workflow surface, not the primary lookup tool.

Strengths:

- Easy manual status tracking, notes, assignments, and follow-up dates
- Familiar database views for outreach workflow

Limitations:

- Weaker multi-field search and dense record comparison
- No clean way to reproduce the app's filtered CSV export
- Syncing 52 source records requires a Notion integration token and record identity rules
- Public contact and loan data would be copied into a third-party workspace

Recommended future pattern: keep the Next.js app as the source lookup interface and add an explicit “Send to outreach queue” action to a private Notion database only if Amanda wants CRM-style tracking.

## Privacy and access

The source data is public, but the tool expresses Amanda's prospecting strategy. Deploy privately or use Vercel deployment protection if the workflow should remain internal. Do not add employee notes, customer information, or outreach history to the public JSON bundle.
