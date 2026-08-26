'use client';

import { useCallback, useEffect, useState } from 'react';

type Invite = { id: string; code_prefix: string; role: string; max_uses: number; use_count: number; expires_at: string; revoked_at: string | null };
type Member = { clerk_user_id: string; email: string; role: string; active: boolean; created_at: string };

export default function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newCode, setNewCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/invites', { cache: 'no-store' });
    const body = await response.json();
    if (response.ok) { setInvites(body.invites); setMembers(body.members); }
    else setMessage(body.error || 'Could not load invitations.');
    setLoading(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/invites', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (response.ok) { setInvites(body.invites); setMembers(body.members); }
        else setMessage(body.error || 'Could not load invitations.');
      })
      .catch((error) => { if (error.name !== 'AbortError') setMessage('Could not load invitations.'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setNewCode('');
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/invites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: data.get('role'), maxUses: Number(data.get('maxUses')), expiresInDays: Number(data.get('expiresInDays')) }),
    });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || 'Could not create invitation.'); return; }
    setNewCode(body.code); setMessage('Copy this code now. Only its hash is stored, so it cannot be shown again.'); await refresh();
  }

  async function revoke(id: string) {
    await fetch('/api/invites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await refresh();
  }

  return <div className="admin-grid">
    <section className="workspace-card">
      <h2>Create an invitation</h2>
      <form className="invite-form" onSubmit={create}>
        <label className="field"><span>Access level</span><select name="role" defaultValue="member"><option value="member">Member — research and edit</option><option value="viewer">Viewer — app access</option></select></label>
        <label className="field"><span>Maximum uses</span><input name="maxUses" type="number" min="1" max="25" defaultValue="1" /></label>
        <label className="field"><span>Expires in days</span><input name="expiresInDays" type="number" min="1" max="90" defaultValue="7" /></label>
        <button className="button primary" type="submit">Create code</button>
      </form>
      {newCode ? <div className="invite-code"><code>{newCode}</code><button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(newCode)}>Copy</button></div> : null}
      {message ? <p className="zip-message" role="status">{message}</p> : null}
    </section>
    <section className="workspace-card"><h2>Invitations</h2>{loading ? <p>Loading…</p> : <div className="admin-list">{invites.map((invite) => <article key={invite.id}><div><strong>{invite.code_prefix}…</strong><span>{invite.role} · {invite.use_count}/{invite.max_uses} used · expires {new Date(invite.expires_at).toLocaleDateString()}</span></div>{invite.revoked_at ? <b>Revoked</b> : <button className="text-button" type="button" onClick={() => revoke(invite.id)}>Revoke</button>}</article>)}</div>}</section>
    <section className="workspace-card"><h2>Members</h2><div className="admin-list">{members.map((member) => <article key={member.clerk_user_id}><div><strong>{member.email}</strong><span>{member.role} · {member.active ? 'active' : 'inactive'}</span></div></article>)}</div></section>
  </div>;
}
