import { isAuthorized, privateHeaders } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!await isAuthorized(request, { write: true })) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  const body = await request.json() as { legalName?: string };
  const legalName = body.legalName?.trim();
  if (!legalName || legalName.length > 200) {
    return Response.json({ error: 'A reviewed legal business name is required.' }, { status: 400, headers: privateHeaders });
  }
  return Response.json({
    mode: 'assisted_public_search',
    searchUrl: 'https://ucc.michigan.gov/ucc-search',
    debtorName: legalName,
    instructions: [
      'Open the official Michigan UCC search.',
      'Search the reviewed legal name as an organization debtor.',
      'Record only a filing shown by the official result.',
      'Capture filing number, status, secured party, source URL and observed date.',
      'Do not treat a secured party as the business\'s deposit bank.',
    ],
    automationDisabledReason: 'The official search is intentionally human-reviewed; the app does not bypass controls or bulk-harvest UCC data.',
  }, { headers: privateHeaders });
}
