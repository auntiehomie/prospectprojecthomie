import { createHash, randomBytes } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { AppRole } from '@/lib/auth';

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashInviteCode(value: string) {
  return createHash('sha256').update(normalizeInviteCode(value)).digest('hex');
}

export function createInviteCode() {
  const raw = randomBytes(10).toString('hex').toUpperCase();
  return `HOMIE-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
}

export async function createInvite(input: {
  createdBy: string;
  role: Exclude<AppRole, 'owner'>;
  maxUses: number;
  expiresAt: string;
}) {
  const sql = getDb();
  const code = createInviteCode();
  const hash = hashInviteCode(code);
  const prefix = code.slice(0, 11);
  const rows = await sql`
    INSERT INTO app_invites (code_hash, code_prefix, role, max_uses, expires_at, created_by)
    VALUES (${hash}, ${prefix}, ${input.role}, ${input.maxUses}, ${input.expiresAt}, ${input.createdBy})
    RETURNING id, code_prefix, role, max_uses, use_count, expires_at, created_at
  `;
  return { ...rows[0], code };
}
