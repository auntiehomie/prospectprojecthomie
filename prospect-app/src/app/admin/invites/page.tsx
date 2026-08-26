import { redirect } from 'next/navigation';
import Link from 'next/link';
import InviteManager from '@/components/InviteManager';
import { getAppMember } from '@/lib/auth';

export default async function InvitesPage() {
  const member = await getAppMember();
  if (!member) redirect('/sign-in');
  if (member.role !== 'owner') redirect('/');
  return (
    <main className="admin-shell page-shell">
      <div className="admin-heading"><div><p className="eyebrow">Owner controls</p><h1>Invitations and members</h1></div><Link href="/">Back to prospects</Link></div>
      <InviteManager />
    </main>
  );
}
