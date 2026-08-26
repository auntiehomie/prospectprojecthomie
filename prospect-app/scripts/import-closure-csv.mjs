import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { neon } from '@neondatabase/serverless';

const file = process.argv[2];
const institution = process.argv[3];
if (!file || !institution) throw new Error('Usage: npm run import:closures -- path/to/official-cas.csv "Fifth Third Bank"');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (process.env.CONFIRM_OFFICIAL_CLOSURE_IMPORT !== 'yes') throw new Error('Set CONFIRM_OFFICIAL_CLOSURE_IMPORT=yes after reviewing the source file and institution name.');
const sql = neon(process.env.DATABASE_URL);
const records = parse(await readFile(resolve(file)), { columns: true, skip_empty_lines: true, bom: true });
let imported = 0;
for (const row of records) {
  const sourceUrl = row.URL || row.source_url;
  if (!/^https:\/\/(apps\.occ\.gov|www\.occ\.gov|banks\.data\.fdic\.gov|api\.fdic\.gov)\//.test(sourceUrl || '')) {
    console.warn(`Skipped ${row['Branch Name'] || 'row'}: source is not an approved OCC/FDIC URL.`); continue;
  }
  const [branch] = await sql`INSERT INTO bank_branches (institution_name,branch_name,address_line,city,state,zip_code,source_url,observed_at) VALUES (${institution},${row['Branch Name'] || row.branch_name},${row.Address || row.address},${row.City || row.city},${row.State || row.state},${row['Zip Code'] || row.zip_code},${sourceUrl},current_date) ON CONFLICT DO NOTHING RETURNING id`;
  const id = branch?.id || (await sql`SELECT id FROM bank_branches WHERE source_url=${sourceUrl} LIMIT 1`)[0]?.id;
  if (!id) continue;
  await sql`INSERT INTO branch_closure_events (branch_id,status,filed_at,effective_at,regulator,filing_id,source_url,observed_at) VALUES (${id},${row.status || 'filed'},${row['Action Date'] || row.filed_at || null},${row.effective_at || null},${sourceUrl.includes('fdic') ? 'FDIC' : 'OCC'},${row['Application Number'] || row.filing_id || null},${sourceUrl},current_date) ON CONFLICT (branch_id,source_url) DO UPDATE SET status=EXCLUDED.status,effective_at=EXCLUDED.effective_at,observed_at=current_date`;
  imported += 1;
}
console.log(`Imported ${imported} reviewed closure records for ${institution}.`);
