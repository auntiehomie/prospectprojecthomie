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
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Verification

```bash
npm run lint
npm run build
```

## Updating data

The canonical generated JSON file lives one directory above the app:

```bash
npm run sync-data
```

This copies `../PPP-Prospect-Results.json` into `src/data/prospects.json` for the statically built app.

## Deployment

Recommended: import the repository into Vercel and set the root directory to `prospect-app`. No runtime secrets or database are required for the current read-only version.
