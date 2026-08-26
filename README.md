# Prospect Project Homie

An interactive business-prospecting tool for identifying forgiven PPP borrowers near Comerica/Fifth Third branches slated to close in the Farmington Hills and West Bloomfield area.

## What the project does

The current qualified list contains businesses that:

- received a forgiven PPP loan of at least $50,000;
- used Comerica Bank as the PPP lender;
- are in ZIP codes 48322, 48331, 48334, or 48335;
- are within two miles of a listed closing branch; and
- are not liquor stores or suspected money-services businesses.

The included Next.js app turns the researched CSV into a self-service lookup tool with full-text search, filters, sorting, record notes, and filtered CSV export. Its persistent data platform can also discover reviewed business seeds by Michigan ZIP, cross-reference them with sourced branch-closure events, and rank opportunities without treating an inference as fact.

## Data sources

- [SBA PPP FOIA dataset](https://data.sba.gov/dataset/ppp-foia) — borrower, lender, loan, forgiveness, and NAICS fields. The PPP program has ended, so this is historical data and the SBA publishes it as large bulk CSV files.
- `Results-Table.csv` — OCC branch-closing filings used for the closing-branch list.
- Public business websites and directories — phone, email, operating status, and verification notes. These fields can become stale and should be checked before outreach.

## Repository layout

- `PPP-Prospect-Results.csv` — curated prospect output
- `PPP-Prospect-Results.json` — app-ready generated copy
- `PPP-Prospect-Results.md` — human-readable research output
- `Results-Table.csv` — branch-closing source data
- `audit_data.py` — descriptive data-quality report
- `validate_csv.py` — strict CI validator
- `refresh_ppp_data.py` — reproducible rebuild/filter utility
- `DEPLOYMENT-OPTIONS.md` — web-tool and Notion assessment
- `prospect-app/` — interactive Next.js application

## Run the interactive app

```bash
cd prospect-app
nvm use
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Validate the repository

```bash
python3 validate_csv.py
python3 audit_data.py
cd prospect-app
npm run lint
npm run build
```

GitHub Actions runs CSV validation, lint, and the production build on pushes and pull requests.

## Refreshing the prospect data

### Safe rebuild using the curated CSV

This refreshes derived branch fields while retaining manually researched contact sources and notes:

```bash
python3 refresh_ppp_data.py --rebuild --branch-file Results-Table.csv --output-dir refreshed
```

Write to a review directory first and compare the output before replacing the curated file.

### Full SBA rebuild

The official SBA source is split across large files totaling multiple gigabytes:

```bash
python3 refresh_ppp_data.py --download-sba --source-dir sba_source
python3 refresh_ppp_data.py --source-dir sba_source --branch-file Results-Table.csv --output-dir refreshed
```

A full rebuild supplies PPP fields but cannot reproduce manually researched phone numbers, emails, and operating-status notes. Merge reviewed contact research rather than overwriting it.

### Sync data into the app

After regenerating `PPP-Prospect-Results.json`:

```bash
cd prospect-app
npm run sync-data
```

## Deployment

Recommended deployment is Vercel with `prospect-app` as the root directory. See `DEPLOYMENT-OPTIONS.md` for the decision and privacy notes. No database or runtime API key is required for the current read-only app.

The live ZIP intelligence and evidence APIs require a Neon/Postgres database. Provision Neon through the Vercel Marketplace, apply `prospect-app/db/001_prospect_platform.sql`, then run `npm run db:seed` from `prospect-app`. Add `DATABASE_URL` and `PROSPECT_APP_ACCESS_CODE` to Vercel before using the private routes.

### Above-ground data workflow

- `npm run import:closures -- official.csv "Institution Name"` accepts reviewed OCC/FDIC closure exports and rejects unrelated source domains.
- `npm run discover:zip -- 48334` creates OpenStreetMap discovery seeds. It requires explicit confirmation and leaves every business unverified.
- `npm run db:geocode` geocodes reviewed records at a policy-respecting rate and requires an identifying user agent.
- Michigan UCC research remains assisted and human-reviewed; the app never bypasses access controls or bulk-harvests results.
- Every relationship and need signal requires a source, observation date and confidence. PPP is historical evidence, not proof of a current account.

Use Node.js 24.x in Vercel, leave the output directory blank at the Next.js default, and enable Vercel Deployment Protection if the prospecting workflow should remain private. The committed `prospect-app/vercel.json` selects Next.js and clears stale output-directory overrides. The app also sends `noindex` metadata to reduce accidental search-engine discovery.

## Data-quality snapshot

As of August 2, 2026:

- 52 curated prospect rows and 81 branch-closing rows
- no duplicate business/address or application-number keys
- nine prospects lack a phone number
- 36 prospects lack a publicly verified email
- several rows contain caution notes for possible closure, relocation, identity mismatch, or unverified contact information

Missing public contact information is retained as blank rather than guessed.
