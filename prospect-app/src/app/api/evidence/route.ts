import { addEvidence, getEvidence, deleteEvidence } from '@/lib/storage';
import { isAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';

function noStore() {
  return { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
}

export async function GET(request: Request) {
  if (!await isAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  const url = new URL(request.url);
  const businessName = url.searchParams.get('businessName') || undefined;
  return Response.json(await getEvidence(businessName), { headers: noStore() });
}

export async function POST(request: Request) {
  if (!await isAuthorized(request, { write: true })) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  try {
    const body = await request.json() as { businessName: string; address: string; label: string; source: string; confidence: string; detail: string };
    if (!body.businessName || !body.label || !body.source) {
      return Response.json({ error: 'businessName, label, and source are required' }, { status: 400, headers: noStore() });
    }
    const entry = await addEvidence({
      businessName: body.businessName,
      address: body.address || '',
      label: body.label,
      source: body.source,
      confidence: (['confirmed', 'likely', 'possible', 'unverified'].includes(body.confidence) ? body.confidence : 'unverified') as 'confirmed' | 'likely' | 'possible' | 'unverified',
      detail: body.detail || '',
    });
    return Response.json(entry, { status: 201, headers: noStore() });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: noStore() });
  }
}

export async function DELETE(request: Request) {
  if (!await isAuthorized(request, { write: true })) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400, headers: noStore() });
  const ok = await deleteEvidence(id);
  return Response.json({ ok }, { status: ok ? 200 : 404, headers: noStore() });
}
