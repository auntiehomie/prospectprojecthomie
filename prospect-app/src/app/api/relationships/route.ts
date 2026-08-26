import { getDb } from '@/lib/db';
import { isAuthorized, privateHeaders } from '@/lib/auth';

const types = ['ppp_lender','sba_lender','ucc_secured_party','mortgage_lender','public_announcement','human_confirmed'];
const confidences = ['confirmed','likely','possible','unverified'];

export async function POST(request: Request) {
  if (!await isAuthorized(request, { write: true })) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  try {
    const body = await request.json() as Record<string, string>;
    if (!body.businessId || !body.institutionName || !types.includes(body.relationshipType)
      || !confidences.includes(body.confidence) || !/^https:\/\//.test(body.sourceUrl || '') || !body.matchReason) {
      return Response.json({ error: 'Business, institution, allowed relationship type, confidence, HTTPS source and match reason are required.' }, { status: 400, headers: privateHeaders });
    }
    const sql = getDb();
    const [entry] = await sql`
      INSERT INTO relationship_evidence (business_id,institution_name,relationship_type,relationship_date,status,confidence,source_url,observed_at,match_reason)
      VALUES (${body.businessId},${body.institutionName},${body.relationshipType},${body.relationshipDate || null},${body.status || 'unknown'},${body.confidence},${body.sourceUrl},current_date,${body.matchReason}) RETURNING *
    `;
    return Response.json(entry, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error('relationship evidence write failed', error);
    return Response.json({ error: 'Relationship evidence could not be saved.' }, { status: 400, headers: privateHeaders });
  }
}
