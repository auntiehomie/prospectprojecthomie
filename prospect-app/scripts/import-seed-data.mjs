import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const sql = neon(databaseUrl);
const root = resolve(process.cwd(), '..');
const prospects = parse(await readFile(resolve(root, 'PPP-Prospect-Results.csv')), { columns: true, skip_empty_lines: true, bom: true });
const branches = parse(await readFile(resolve(root, 'Results-Table.csv')), { columns: true, skip_empty_lines: true, bom: true });
const observedAt = new Date().toISOString().slice(0, 10);

for (const row of branches) {
  const [branch] = await sql`
    INSERT INTO bank_branches (institution_name, branch_name, address_line, city, state, zip_code, source_url, observed_at)
    VALUES ('Comerica Bank', ${row['Branch Name']}, ${row.Address}, ${row.City}, ${row.State}, ${row['Zip Code']}, ${row.URL}, ${observedAt})
    ON CONFLICT DO NOTHING RETURNING id
  `;
  const branchId = branch?.id || (await sql`SELECT id FROM bank_branches WHERE source_url = ${row.URL} LIMIT 1`)[0]?.id;
  if (branchId) await sql`
    INSERT INTO branch_closure_events (branch_id, status, filed_at, regulator, filing_id, source_url, observed_at)
    VALUES (${branchId}, 'filed', ${row['Action Date'] || null}, 'OCC', ${row['Application Number']}, ${row.URL}, ${observedAt})
    ON CONFLICT (branch_id, source_url) DO UPDATE SET observed_at = EXCLUDED.observed_at
  `;
}

for (const row of prospects) {
  const [business] = await sql`
    INSERT INTO businesses (legal_name, display_name, status, naics_code, source_url, observed_at)
    VALUES (${row['Business Name']}, ${row['Business Name']}, 'unverified', ${row['NAICS Code'] || null}, 'https://data.sba.gov/dataset/ppp-foia', ${observedAt})
    ON CONFLICT DO NOTHING RETURNING id
  `;
  const businessId = business?.id || (await sql`SELECT id FROM businesses WHERE legal_name = ${row['Business Name']} LIMIT 1`)[0]?.id;
  if (!businessId) continue;
  await sql`
    INSERT INTO business_locations (business_id, address_line, city, state, zip_code)
    VALUES (${businessId}, ${row.Address}, ${row.City}, ${row.State}, ${row['Zip Code']})
    ON CONFLICT (business_id, address_line, zip_code) DO NOTHING
  `;
  await sql`
    INSERT INTO relationship_evidence
      (business_id, institution_name, relationship_type, status, confidence, source_url, observed_at, match_reason)
    VALUES (${businessId}, ${row['PPP Lender']}, 'ppp_lender', 'historical', 'confirmed',
      'https://data.sba.gov/dataset/ppp-foia', ${observedAt}, 'SBA PPP borrower record names this lender; this does not establish a current relationship.')
  `;
  if (row.Phone) await sql`
    INSERT INTO stored_contacts (business_id, business_name, address, contact_type, value, source, verified)
    VALUES (${businessId}, ${row['Business Name']}, ${row.Address}, 'phone', ${row.Phone}, ${row['Contact Source'] || 'curated CSV'}, false)
  `;
  if (row.Email) await sql`
    INSERT INTO stored_contacts (business_id, business_name, address, contact_type, value, source, verified)
    VALUES (${businessId}, ${row['Business Name']}, ${row.Address}, 'email', ${row.Email}, ${row['Contact Source'] || 'curated CSV'}, false)
  `;
}

console.log(`Imported ${prospects.length} PPP seeds and ${branches.length} OCC closure filings.`);
