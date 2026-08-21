import { addOutreach, getOutreach, updateOutreach } from '@/lib/storage';
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
  return Response.json(getOutreach(businessName), { headers: noStore() });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  try {
    const body = await request.json() as {
      businessName: string; address: string; outcome: string; notes: string; contactMethod?: string;
    };
    if (!body.businessName) {
      return Response.json({ error: 'businessName is required' }, { status: 400, headers: noStore() });
    }
    const outcomes = ['pending', 'contacted', 'responded', 'qualified', 'not_interested', 'opted_out'];
    const entry = addOutreach({
      businessName: body.businessName,
      address: body.address || '',
      outcome: (outcomes.includes(body.outcome) ? body.outcome : 'pending') as 'pending' | 'contacted' | 'responded' | 'qualified' | 'not_interested' | 'opted_out',
      notes: (body.notes || '').slice(0, 1000),
      contactMethod: body.contactMethod || undefined,
      contactedAt: body.outcome !== 'pending' ? new Date().toISOString() : undefined,
    });
    return Response.json(entry, { status: 201, headers: noStore() });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: noStore() });
  }
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  try {
    const body = await request.json() as { id: string; outcome?: string; notes?: string; contactMethod?: string };
    if (!body.id) return Response.json({ error: 'id required' }, { status: 400, headers: noStore() });
    const patch: Record<string, unknown> = {};
    if (body.outcome) patch.outcome = body.outcome;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.contactMethod) patch.contactMethod = body.contactMethod;
    if (body.outcome && body.outcome !== 'pending') patch.contactedAt = new Date().toISOString();
    const updated = updateOutreach(body.id, patch as Parameters<typeof updateOutreach>[1]);
    if (!updated) return Response.json({ error: 'Not found' }, { status: 404, headers: noStore() });
    return Response.json(updated, { headers: noStore() });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: noStore() });
  }
}