import { getAppMember, privateHeaders } from '@/lib/auth';
import { createInvite } from '@/lib/invites';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

async function requireOwner() {
  const member = await getAppMember();
  return member?.role === 'owner' ? member : null;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner) return Response.json({ error: 'Owner access required.' }, { status: 403, headers: privateHeaders });
  const sql = getDb();
  const invites = await sql`
    SELECT id, code_prefix, role, max_uses, use_count, expires_at, revoked_at, created_at
    FROM app_invites WHERE created_by = ${owner.clerkUserId} ORDER BY created_at DESC LIMIT 100
  `;
  const members = await sql`
    SELECT clerk_user_id, email, role, active, created_at
    FROM app_users ORDER BY created_at DESC LIMIT 100
  `;
  return Response.json({ invites, members }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner) return Response.json({ error: 'Owner access required.' }, { status: 403, headers: privateHeaders });
  const body = await request.json().catch(() => null) as { role?: string; maxUses?: number; expiresInDays?: number } | null;
  const role = body?.role === 'viewer' ? 'viewer' : 'member';
  const maxUses = Math.min(25, Math.max(1, Number(body?.maxUses) || 1));
  const expiresInDays = Math.min(90, Math.max(1, Number(body?.expiresInDays) || 7));
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();
  const invite = await createInvite({ createdBy: owner.clerkUserId, role, maxUses, expiresAt });
  return Response.json(invite, { status: 201, headers: privateHeaders });
}

export async function PATCH(request: Request) {
  const owner = await requireOwner();
  if (!owner) return Response.json({ error: 'Owner access required.' }, { status: 403, headers: privateHeaders });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return Response.json({ error: 'Invitation id is required.' }, { status: 400, headers: privateHeaders });
  const sql = getDb();
  const rows = await sql`
    UPDATE app_invites SET revoked_at = now()
    WHERE id = ${body.id} AND created_by = ${owner.clerkUserId} AND revoked_at IS NULL
    RETURNING id
  `;
  return Response.json({ ok: Boolean(rows[0]) }, { status: rows[0] ? 200 : 404, headers: privateHeaders });
}
