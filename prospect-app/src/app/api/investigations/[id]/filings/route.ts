import { getAppMember, privateHeaders } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const member = await getAppMember();
  if (!member || member.role === 'viewer') return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, string>;
    const filingNumber = clean(body.filingNumber, 100);
    const securedParty = clean(body.securedParty, 240);
    const sourceUrl = clean(body.sourceUrl, 800);
    const status = clean(body.filingStatus, 20) || 'unknown';
    if (!filingNumber || !securedParty || !['active','lapsed','terminated','unknown'].includes(status) || !isHttpsUrl(sourceUrl)) {
      return Response.json({ error: 'Filing number, secured party, valid status, and official HTTPS source are required.' }, { status: 400, headers: privateHeaders });
    }
    const sql = getDb();
    const [filing] = await sql`
      INSERT INTO ucc_filings
        (investigation_id, filing_number, filing_status, filing_date, secured_party,
         collateral_summary, source_url, observed_at, reviewer_note)
      SELECT i.id, ${filingNumber}, ${status}, ${clean(body.filingDate, 10) || null}, ${securedParty},
        ${clean(body.collateralSummary, 4000)}, ${sourceUrl},
        ${clean(body.observedAt, 10) || new Date().toISOString().slice(0, 10)}, ${clean(body.reviewerNote, 2000)}
      FROM business_investigations i
      WHERE i.id = ${id} AND i.created_by = ${member.clerkUserId}
      RETURNING *
    `;
    if (!filing) return Response.json({ error: 'Investigation not found.' }, { status: 404, headers: privateHeaders });
    await sql`UPDATE business_investigations SET updated_at = now() WHERE id = ${id}`;
    return Response.json(filing, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error('UCC filing create failed', error);
    return Response.json({ error: 'The UCC filing could not be saved. Check for a duplicate filing.' }, { status: 400, headers: privateHeaders });
  }
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
