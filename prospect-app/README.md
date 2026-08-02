# Prospect Project Homie — Web App

Interactive Next.js search for qualified PPP prospects near closing Comerica/Fifth Third branches.

## Features

- Full-text search across businesses, addresses, NAICS codes, contacts, and notes
- Filters for ZIP code, closing branch, minimum loan, distance, and contact availability
- Sortable prospect results
- Expandable source and verification notes
- Export the current filtered list to CSV
- Responsive desktop/mobile interface

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
- Output directory: leave at the Next.js default
- Environment variables: none

The deployment is read-only and does not require runtime secrets or a database. The prospect dataset and outreach strategy are included in the browser-delivered app, so enable Vercel Deployment Protection if the site should remain private.
