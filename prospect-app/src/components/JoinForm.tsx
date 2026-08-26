'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function redeem(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage('');
    const response = await fetch('/api/invites/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || 'The invitation could not be redeemed.'); setLoading(false); return; }
    router.replace('/'); router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={redeem}>
      <label className="field"><span>Invitation code</span><input value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="characters" autoComplete="one-time-code" required /></label>
      <button className="button primary" type="submit" disabled={loading}>{loading ? 'Activating…' : 'Activate access'}</button>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
    </form>
  );
}
