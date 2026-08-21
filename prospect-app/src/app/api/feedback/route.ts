import { addFeedback, getFeedback } from '@/lib/storage';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const expected = process.env.PROSPECT_APP_ACCESS_CODE;
  if (!expected) return process.env.NODE_ENV !== 'production';
  const supplied = request.headers.get('x-prospect-access-code') || '';
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function noStore() {
  return { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  const url = new URL(request.url);
  const businessName = url.searchParams.get('businessName') || undefined;
  return Response.json(getFeedback(businessName), { headers: noStore() });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  try {
    const body = await request.json() as { businessName: string; address: string; recommendationId: string; agreement: string; notes: string };
    if (!body.businessName || !body.agreement) {
      return Response.json({ error: 'businessName and agreement are required' }, { status: 400, headers: noStore() });
    }
    const entry = addFeedback({
      businessName: body.businessName,
      address: body.address || '',
      recommendationId: body.recommendationId || '',
      agreement: (['agree', 'disagree', 'partial', 'skip'].includes(body.agreement) ? body.agreement : 'skip') as 'agree' | 'disagree' | 'partial' | 'skip',
      notes: (body.notes || '').slice(0, 500),
    });
    return Response.json(entry, { status: 201, headers: noStore() });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: noStore() });
  }
}