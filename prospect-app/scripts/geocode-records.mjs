import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (process.env.CONFIRM_PUBLIC_GEOCODING !== 'yes') {
  throw new Error('Set CONFIRM_PUBLIC_GEOCODING=yes after reviewing the Nominatim usage policy.');
}
const sql = neon(databaseUrl);
const userAgent = process.env.GEOCODER_USER_AGENT;
if (!userAgent?.includes('@')) throw new Error('GEOCODER_USER_AGENT must identify the application and a contact email.');

const businessLocations = await sql`SELECT id, address_line, city, state, zip_code FROM business_locations WHERE latitude IS NULL LIMIT 200`;
const branches = await sql`SELECT id, address_line, city, state, zip_code FROM bank_branches WHERE latitude IS NULL LIMIT 200`;
const records = [...businessLocations.map((r) => ({ ...r, table: 'business_locations' })), ...branches.map((r) => ({ ...r, table: 'bank_branches' }))];

for (const record of records) {
  const query = `${record.address_line}, ${record.city}, ${record.state} ${record.zip_code}`;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');
  const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
  const match = (await response.json())[0];
  if (match) {
    if (record.table === 'business_locations') await sql`
      UPDATE business_locations SET latitude = ${Number(match.lat)}, longitude = ${Number(match.lon)},
        geocode_source_url = ${url.toString()}, geocoded_at = now() WHERE id = ${record.id}
    `;
    else await sql`UPDATE bank_branches SET latitude = ${Number(match.lat)}, longitude = ${Number(match.lon)} WHERE id = ${record.id}`;
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1100));
}

console.log(`Reviewed ${records.length} ungeocoded records.`);
