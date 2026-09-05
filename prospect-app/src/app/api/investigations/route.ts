import { getAppMember, privateHeaders } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type InvestigationInput = {
  legalName?: string;
  displayName?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  websiteUrl?: string;
  notes?: string;
};

export async function GET() {
  const member = await getAppMember();
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  try {
    const sql = getDb();
    const investigations = await sql`
      SELECT i.*,
        COALESCE(json_agg(f ORDER BY f.filing_date DESC NULLS LAST, f.created_at DESC)
          FILTER (WHERE f.id IS NOT NULL), '[]') AS filings
      FROM business_investigations i
      LEFT JOIN ucc_filings f ON f.investigation_id = i.id
      WHERE i.created_by = ${member.clerkUserId}
      GROUP BY i.id
      ORDER BY i.updated_at DESC
    `;
    return Response.json({ investigations }, { headers: privateHeaders });
  } catch (error) {
    console.error('investigation list failed', error);
    return Response.json({ error: 'Investigations are unavailable. Run the latest database migration.' }, { status: 503, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  const member = await getAppMember();
  if (!member || member.role === 'viewer') return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  try {
    const body = await request.json() as InvestigationInput;
    const legalName = clean(body.legalName, 200);
    const city = clean(body.city, 100);
    const state = clean(body.state, 2).toUpperCase() || 'MI';
    const websiteUrl = clean(body.websiteUrl, 500);
    if (!legalName || !city || !/^[A-Z]{2}$/.test(state)) {
      return Response.json({ error: 'Legal business name, city, and two-letter state are required.' }, { status: 400, headers: privateHeaders });
    }
    if (websiteUrl && !isHttpsUrl(websiteUrl)) {
      return Response.json({ error: 'Website must be a valid HTTPS URL.' }, { status: 400, headers: privateHeaders });
    }
    const sql = getDb();
    const [investigation] = await sql`
      INSERT INTO business_investigations
        (created_by, legal_name, display_name, address_line, city, state, zip_code, website_url, notes)
      VALUES
        (${member.clerkUserId}, ${legalName}, ${clean(body.displayName, 200) || legalName},
         ${clean(body.addressLine, 240)}, ${city}, ${state}, ${clean(body.zipCode, 20)},
         ${websiteUrl || null}, ${clean(body.notes, 2000)})
      RETURNING *
    `;
    return Response.json({ ...investigation, filings: [] }, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error('investigation create failed', error);
    return Response.json({ error: 'The investigation could not be created.' }, { status: 400, headers: privateHeaders });
  }
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
