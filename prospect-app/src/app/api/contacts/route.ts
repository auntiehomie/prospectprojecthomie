import { addContact, getContacts, deleteContact, addOptOut, isOptedOut, removeOptOut, getOptOuts, exportAll, getStats } from '@/lib/storage';
import { isAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';

function noStore() {
  return { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
}

// GET /api/contacts?businessName=X | ?action=stats | ?action=export | ?action=optouts
export async function GET(request: Request) {
  if (!await isAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'stats') return Response.json(await getStats(), { headers: noStore() });
  if (action === 'export') return Response.json(await exportAll(), { headers: noStore() });
  if (action === 'optouts') return Response.json(await getOptOuts(), { headers: noStore() });

  const businessName = url.searchParams.get('businessName') || undefined;
  return Response.json(await getContacts(businessName), { headers: noStore() });
}

export async function POST(request: Request) {
  if (!await isAuthorized(request, { write: true })) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore() });
  try {
    const body = await request.json() as Record<string, unknown>;

    // Opt-out action
    if (body.action === 'optout') {
      const entry = await addOptOut({
        businessName: String(body.businessName || ''),
        address: String(body.address || ''),
        reason: String(body.reason || ''),
      });
      return Response.json(entry, { status: 201, headers: noStore() });
    }

    // Check opt-out status
    if (body.action === 'check-optout') {
      const optedOut = await isOptedOut(String(body.businessName || ''), String(body.address || ''));
      return Response.json({ optedOut }, { headers: noStore() });
    }

    // Add contact
    if (!body.businessName || !body.value) {
      return Response.json({ error: 'businessName and value are required' }, { status: 400, headers: noStore() });
    }
    const entry = await addContact({
      businessName: String(body.businessName),
      address: String(body.address || ''),
      contactType: (['phone', 'email', 'linkedin', 'website', 'other'].includes(String(body.contactType)) ? String(body.contactType) : 'other') as 'phone' | 'email' | 'linkedin' | 'website' | 'other',
      value: String(body.value),
      source: String(body.source || ''),
      verified: Boolean(body.verified),
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
  const action = url.searchParams.get('action');

  if (action === 'optout') {
    const businessName = url.searchParams.get('businessName') || '';
    const address = url.searchParams.get('address') || '';
    const ok = await removeOptOut(businessName, address);
    return Response.json({ ok }, { status: ok ? 200 : 404, headers: noStore() });
  }

  if (!id) return Response.json({ error: 'id required' }, { status: 400, headers: noStore() });
  const ok = await deleteContact(id);
  return Response.json({ ok }, { status: ok ? 200 : 404, headers: noStore() });
}
