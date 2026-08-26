import { auth, currentUser } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { hashInviteCode } from '@/lib/invites';
import { privateHeaders } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Sign in before redeeming an invitation.' }, { status: 401, headers: privateHeaders });
  const body = await request.json().catch(() => null) as { code?: string } | null;
  if (!body?.code) return Response.json({ error: 'Enter an invitation code.' }, { status: 400, headers: privateHeaders });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return Response.json({ error: 'Your account needs a verified email address.' }, { status: 400, headers: privateHeaders });
  const sql = getDb();

  const existing = await sql`SELECT role FROM app_users WHERE clerk_user_id = ${userId} AND active = true LIMIT 1`;
  if (existing[0]) return Response.json({ ok: true, role: existing[0].role }, { headers: privateHeaders });

  const bootstrapCode = process.env.PROSPECT_BOOTSTRAP_INVITE_CODE;
  if (bootstrapCode && hashInviteCode(body.code) === hashInviteCode(bootstrapCode)) {
    const rows = await sql`
      INSERT INTO app_users (clerk_user_id, email, role)
      SELECT ${userId}, ${email}, 'owner'
      WHERE NOT EXISTS (SELECT 1 FROM app_users)
      ON CONFLICT (clerk_user_id) DO NOTHING
      RETURNING role
    `;
    if (rows[0]) return Response.json({ ok: true, role: 'owner' }, { headers: privateHeaders });
  }

  const codeHash = hashInviteCode(body.code);
  const rows = await sql`
    WITH candidate AS (
      SELECT id, role, created_by FROM app_invites
      WHERE code_hash = ${codeHash} AND revoked_at IS NULL AND expires_at > now() AND use_count < max_uses
      FOR UPDATE
    ), used AS (
      UPDATE app_invites i SET use_count = i.use_count + 1 FROM candidate c WHERE i.id = c.id
      RETURNING i.id, i.role, i.created_by
    ), member AS (
      INSERT INTO app_users (clerk_user_id, email, role, invited_by)
      SELECT ${userId}, ${email}, role, created_by FROM used
      ON CONFLICT (clerk_user_id) DO UPDATE SET active = true, updated_at = now()
      RETURNING clerk_user_id, role
    ), redemption AS (
      INSERT INTO app_invite_redemptions (invite_id, clerk_user_id)
      SELECT used.id, member.clerk_user_id FROM used CROSS JOIN member
      ON CONFLICT DO NOTHING
    ) SELECT role FROM member
  `;
  if (!rows[0]) return Response.json({ error: 'That invitation is invalid, expired, revoked, or fully used.' }, { status: 400, headers: privateHeaders });
  return Response.json({ ok: true, role: rows[0].role }, { headers: privateHeaders });
}
