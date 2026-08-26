import { getDb } from '@/lib/db';
import { isAuthorized, privateHeaders } from '@/lib/auth';

const confidences = ['confirmed','likely','possible','unverified'];

export async function POST(request: Request) {
  if (!await isAuthorized(request, { write: true })) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  try {
    const body = await request.json() as Record<string, string>;
    if (!body.businessId || !body.signalType || !body.claim || !confidences.includes(body.confidence)
      || !/^https:\/\//.test(body.sourceUrl || '')) {
      return Response.json({ error: 'Business, signal type, claim, confidence and HTTPS source are required.' }, { status: 400, headers: privateHeaders });
    }
    const sql = getDb();
    const [entry] = await sql`
      INSERT INTO business_signals (business_id,signal_type,claim,observed_at,expires_at,confidence,source_url)
      VALUES (${body.businessId},${body.signalType},${body.claim},${body.observedAt || new Date().toISOString().slice(0,10)},${body.expiresAt || null},${body.confidence},${body.sourceUrl}) RETURNING *
    `;
    return Response.json(entry, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error('business signal write failed', error);
    return Response.json({ error: 'Business signal could not be saved.' }, { status: 400, headers: privateHeaders });
  }
}
