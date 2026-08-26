import { neon } from '@neondatabase/serverless';

const zip = process.argv[2] || '';
if (!/^48\d{3}$/.test(zip)) throw new Error('Usage: npm run discover:zip -- 48334');
if (process.env.CONFIRM_OSM_DISCOVERY !== 'yes') throw new Error('Set CONFIRM_OSM_DISCOVERY=yes after reviewing OpenStreetMap endpoint and ODbL policies.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const userAgent = process.env.GEOCODER_USER_AGENT;
if (!userAgent?.includes('@')) throw new Error('GEOCODER_USER_AGENT must identify the application and a contact email.');
const sql = neon(process.env.DATABASE_URL);

const geocode = new URL('https://nominatim.openstreetmap.org/search');
geocode.searchParams.set('postalcode', zip); geocode.searchParams.set('state', 'Michigan');
geocode.searchParams.set('country', 'USA'); geocode.searchParams.set('format', 'jsonv2'); geocode.searchParams.set('limit', '1');
const areaResponse = await fetch(geocode, { headers: { 'User-Agent': userAgent } });
if (!areaResponse.ok) throw new Error(`ZIP geocoding failed: ${areaResponse.status}`);
const area = (await areaResponse.json())[0];
if (!area?.boundingbox) throw new Error(`No reviewed boundary found for ${zip}.`);
const [south, north, west, east] = area.boundingbox;
const query = `[out:json][timeout:30];nwr["name"](${south},${west},${north},${east})["shop"~".",i];nwr["name"](${south},${west},${north},${east})["office"~".",i];nwr["name"](${south},${west},${north},${east})["craft"~".",i];out center tags;`;
const overpass = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent }, body: new URLSearchParams({ data: query }) });
if (!overpass.ok) throw new Error(`OpenStreetMap discovery failed: ${overpass.status}`);
const payload = await overpass.json();
let imported = 0;
for (const element of payload.elements || []) {
  const name = String(element.tags?.name || '').trim();
  const lat = element.lat ?? element.center?.lat; const lon = element.lon ?? element.center?.lon;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  const [business] = await sql`INSERT INTO businesses (legal_name,display_name,status,source_url,observed_at) VALUES (${name},${name},'unverified',${sourceUrl},current_date) ON CONFLICT DO NOTHING RETURNING id`;
  const id = business?.id || (await sql`SELECT id FROM businesses WHERE legal_name=${name} LIMIT 1`)[0]?.id;
  if (!id) continue;
  const address = [element.tags?.['addr:housenumber'], element.tags?.['addr:street']].filter(Boolean).join(' ') || 'Address requires review';
  await sql`INSERT INTO business_locations (business_id,address_line,city,state,zip_code,latitude,longitude,geocode_source_url,geocoded_at) VALUES (${id},${address},${element.tags?.['addr:city'] || ''},'MI',${zip},${Number(lat)},${Number(lon)},${sourceUrl},now()) ON CONFLICT (business_id,address_line,zip_code) DO NOTHING`;
  imported += 1;
}
console.log(`Imported ${imported} OpenStreetMap discovery seeds for ${zip}. All remain unverified until LARA/entity review.`);
