import { auth } from '@clerk/nextjs/server';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db';

export type AppRole = 'owner' | 'member' | 'viewer';
export type AppMember = { clerkUserId: string; email: string; role: AppRole };

export function hasClerk() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export async function getAppMember(): Promise<AppMember | null> {
  if (!hasClerk() || !process.env.DATABASE_URL) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const sql = getDb();
  const rows = await sql`
    SELECT clerk_user_id, email, role FROM app_users
    WHERE clerk_user_id = ${userId} AND active = true LIMIT 1
  ` as Array<{ clerk_user_id: string; email: string; role: AppRole }>;
  const member = rows[0];
  return member ? { clerkUserId: member.clerk_user_id, email: member.email, role: member.role } : null;
}

function hasLegacyAccess(request: Request) {
  const expected = process.env.PROSPECT_APP_ACCESS_CODE;
  if (!expected) return process.env.NODE_ENV !== 'production' && !hasClerk();
  const supplied = request.headers.get('x-prospect-access-code') || '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function isAuthorized(request: Request, options: { write?: boolean } = {}) {
  const member = hasClerk() ? await getAppMember() : null;
  if (member && (!options.write || member.role !== 'viewer')) return true;
  return hasLegacyAccess(request);
}

export const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
};
