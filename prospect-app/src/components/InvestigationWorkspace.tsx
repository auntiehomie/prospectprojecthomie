'use client';

import { useEffect, useMemo, useState } from 'react';

type Filing = {
  id: string;
  filing_number: string;
  filing_status: 'active' | 'lapsed' | 'terminated' | 'unknown';
  filing_date: string | null;
  secured_party: string;
  collateral_summary: string;
  source_url: string;
  observed_at: string;
  reviewer_note: string;
};

type Investigation = {
  id: string;
  legal_name: string;
  display_name: string;
  address_line: string;
  city: string;
  state: string;
  zip_code: string;
  website_url: string | null;
  notes: string;
  filings: Filing[];
};

type Finding = {
  title: string;
  claim: string;
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  matchReason: string;
  confidence: string;
};

const today = new Date().toISOString().slice(0, 10);
const emptyBusiness = { legalName: '', displayName: '', addressLine: '', city: '', state: 'MI', zipCode: '', websiteUrl: '', notes: '' };
const emptyFiling = { filingNumber: '', filingStatus: 'active', filingDate: '', securedParty: '', collateralSummary: '', sourceUrl: 'https://ucc.michigan.gov/ucc-search', observedAt: today, reviewerNote: '' };

export default function InvestigationWorkspace() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [business, setBusiness] = useState(emptyBusiness);
  const [filing, setFiling] = useState(emptyFiling);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);

  useEffect(() => {
    void fetch('/api/investigations', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { investigations?: Investigation[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not load investigations.');
        setInvestigations(data.investigations || []);
        setSelectedId(data.investigations?.[0]?.id || '');
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = investigations.find((item) => item.id === selectedId) || null;
  const hypotheses = useMemo(() => buildNeedsHypotheses(selected?.filings || [], findings), [selected?.filings, findings]);

  async function createInvestigation(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(business) });
    const data = await response.json() as Investigation & { error?: string };
    if (!response.ok) return setMessage(data.error || 'Could not create investigation.');
    setInvestigations((current) => [data, ...current]);
    setSelectedId(data.id);
    setBusiness(emptyBusiness);
    setFindings([]);
    setMessage('Investigation created. Search the official UCC source and record only reviewed filings.');
  }

  async function saveFiling(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setMessage('');
    const response = await fetch(`/api/investigations/${selected.id}/filings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filing) });
    const data = await response.json() as Filing & { error?: string };
    if (!response.ok) return setMessage(data.error || 'Could not save filing.');
    setInvestigations((current) => current.map((item) => item.id === selected.id ? { ...item, filings: [data, ...item.filings] } : item));
    setFiling(emptyFiling);
    setMessage('UCC filing saved as secured-party evidence. It is not labeled as a deposit relationship.');
  }

  async function researchBusiness() {
    if (!selected) return;
    setResearching(true);
    setMessage('');
    try {
      const response = await fetch('/api/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: selected.legal_name, address: selected.address_line, city: selected.city, state: selected.state, zipCode: selected.zip_code, naicsCode: '' }),
      });
      const data = await response.json() as { findings?: Finding[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Research failed.');
      setFindings(data.findings || []);
      setMessage('Public-web findings are drafts. Review the source and entity match before relying on them.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Research failed.');
    } finally { setResearching(false); }
  }

  if (loading) return <section className="workspace-card"><p>Loading your investigations…</p></section>;

  return (
    <div className="investigation-layout">
      <aside className="workspace-card investigation-sidebar">
        <p className="eyebrow">Your workspace</p>
        <h2>Investigations</h2>
        <div className="investigation-list">
          {investigations.map((item) => (
            <button type="button" key={item.id} className={item.id === selectedId ? 'selected' : ''} onClick={() => { setSelectedId(item.id); setFindings([]); }}>
              <strong>{item.display_name}</strong><span>{item.city}, {item.state} · {item.filings.length} UCC</span>
            </button>
          ))}
          {!investigations.length ? <p className="intel-muted">Create the first business investigation.</p> : null}
        </div>
        <details className="new-investigation" open={!investigations.length}>
          <summary>New investigation</summary>
          <form className="auth-form" onSubmit={createInvestigation}>
            <label className="field"><span>Reviewed legal name *</span><input required value={business.legalName} onChange={(e) => setBusiness({ ...business, legalName: e.target.value })} /></label>
            <label className="field"><span>Display name</span><input value={business.displayName} onChange={(e) => setBusiness({ ...business, displayName: e.target.value })} /></label>
            <label className="field"><span>Street address</span><input value={business.addressLine} onChange={(e) => setBusiness({ ...business, addressLine: e.target.value })} /></label>
            <div className="compact-fields"><label className="field"><span>City *</span><input required value={business.city} onChange={(e) => setBusiness({ ...business, city: e.target.value })} /></label><label className="field"><span>State *</span><input required maxLength={2} value={business.state} onChange={(e) => setBusiness({ ...business, state: e.target.value })} /></label></div>
            <label className="field"><span>ZIP</span><input value={business.zipCode} onChange={(e) => setBusiness({ ...business, zipCode: e.target.value })} /></label>
            <label className="field"><span>Official website</span><input type="url" placeholder="https://…" value={business.websiteUrl} onChange={(e) => setBusiness({ ...business, websiteUrl: e.target.value })} /></label>
            <button className="button primary" type="submit">Create investigation</button>
          </form>
        </details>
      </aside>

      <div className="investigation-main">
        {selected ? <>
          <section className="workspace-card investigation-heading">
            <div><p className="eyebrow">Business investigation</p><h1>{selected.display_name}</h1><p>{selected.address_line ? `${selected.address_line}, ` : ''}{selected.city}, {selected.state} {selected.zip_code}</p></div>
            <button type="button" className="button primary" onClick={researchBusiness} disabled={researching}>{researching ? 'Researching…' : 'Research public web'}</button>
          </section>

          <section className="workspace-card">
            <div className="section-heading"><div><p className="eyebrow">Step 1</p><h2>UCC secured-party evidence</h2></div><a className="button secondary" href={`https://ucc.michigan.gov/ucc-search`} target="_blank" rel="noreferrer">Open Michigan UCC ↗</a></div>
            <p className="guardrail-note">A UCC filing can support a lending or secured-credit relationship on the filing date. It does not prove where the business keeps deposits, whether the relationship is current, or that the secured party is a bank.</p>
            <form className="ucc-form" onSubmit={saveFiling}>
              <label className="field"><span>Filing number *</span><input required value={filing.filingNumber} onChange={(e) => setFiling({ ...filing, filingNumber: e.target.value })} /></label>
              <label className="field"><span>Secured party *</span><input required value={filing.securedParty} onChange={(e) => setFiling({ ...filing, securedParty: e.target.value })} /></label>
              <label className="field"><span>Status</span><select value={filing.filingStatus} onChange={(e) => setFiling({ ...filing, filingStatus: e.target.value })}><option value="active">Active</option><option value="lapsed">Lapsed</option><option value="terminated">Terminated</option><option value="unknown">Unknown</option></select></label>
              <label className="field"><span>Filing date</span><input type="date" value={filing.filingDate} onChange={(e) => setFiling({ ...filing, filingDate: e.target.value })} /></label>
              <label className="field full"><span>Collateral summary</span><textarea rows={3} value={filing.collateralSummary} onChange={(e) => setFiling({ ...filing, collateralSummary: e.target.value })} placeholder="Paraphrase the relevant collateral description…" /></label>
              <label className="field full"><span>Official result URL *</span><input required type="url" value={filing.sourceUrl} onChange={(e) => setFiling({ ...filing, sourceUrl: e.target.value })} /></label>
              <button className="button primary" type="submit">Save reviewed filing</button>
            </form>
            <div className="filing-list">{selected.filings.map((item) => <article key={item.id}><div><strong>{item.secured_party}</strong><span>{item.filing_number} · {item.filing_status} · {item.filing_date || 'date unknown'}</span></div><p>{item.collateral_summary || 'No collateral summary recorded.'}</p><a href={item.source_url} target="_blank" rel="noreferrer">Verify source ↗</a></article>)}</div>
          </section>

          <section className="workspace-card">
            <p className="eyebrow">Step 2</p><h2>Public business evidence</h2>
            <p className="guardrail-note">AI-assisted findings stay separate from reviewed UCC records and remain unverified until a person checks the cited page and entity match.</p>
            <div className="finding-grid">{findings.map((item) => <article key={`${item.sourceUrl}-${item.title}`}><strong>{item.title}</strong><p>{item.claim}</p><small>{item.sourceName} · {item.confidence}</small><a href={item.sourceUrl} target="_blank" rel="noreferrer">Review source ↗</a></article>)}{!findings.length ? <p className="intel-muted">Run public-web research to look for current operations, locations, hiring, equipment, payments, and growth signals.</p> : null}</div>
          </section>

          <section className="workspace-card">
            <p className="eyebrow">Step 3</p><h2>Banking-needs hypotheses</h2>
            <p className="guardrail-note">These are conversation prompts, not facts, approvals, or product recommendations. Confirm needs directly with the business.</p>
            <div className="hypothesis-grid">{hypotheses.map((item) => <article key={item.title}><span>{item.confidence}</span><strong>{item.title}</strong><p>{item.reason}</p></article>)}</div>
          </section>
        </> : <section className="workspace-card empty-state"><h2>No investigation selected</h2><p>Create a business investigation to begin.</p></section>}
        {message ? <p className="evidence-message" role="status">{message}</p> : null}
      </div>
    </div>
  );
}

function buildNeedsHypotheses(filings: Filing[], findings: Finding[]) {
  const text = [...filings.map((item) => item.collateral_summary), ...findings.map((item) => `${item.title} ${item.claim}`)].join(' ').toLowerCase();
  const result: Array<{ title: string; confidence: string; reason: string }> = [];
  if (/equipment|machinery|vehicle|fixture/.test(text)) result.push({ title: 'Equipment financing review', confidence: 'Evidence-linked', reason: 'Recorded evidence mentions equipment, machinery, vehicles, or fixtures. Ask about replacement cycles and existing secured debt.' });
  if (/inventory|accounts receivable|receivables|working capital/.test(text)) result.push({ title: 'Working-capital conversation', confidence: 'Evidence-linked', reason: 'Collateral or public evidence mentions inventory or receivables. Ask about seasonality, cash conversion, and line-of-credit needs.' });
  if (/location|opened|expansion|construction|property|real estate|lease/.test(text)) result.push({ title: 'Expansion and real-estate review', confidence: 'Evidence-linked', reason: 'Public evidence suggests a location, property, construction, or expansion event. Confirm timing and funding needs.' });
  if (/hiring|employees|payroll/.test(text)) result.push({ title: 'Payroll and treasury review', confidence: 'Evidence-linked', reason: 'Public evidence mentions hiring or staffing. Ask about payroll, controls, liquidity, and operating-account workflows.' });
  if (filings.some((item) => item.filing_status === 'active')) result.push({ title: 'Existing credit relationship review', confidence: 'UCC-supported', reason: 'At least one filing is recorded as active. Confirm its current status and whether refinancing or additional capacity is relevant.' });
  result.push({ title: 'Deposits, payments, and cash-management discovery', confidence: 'Needs confirmation', reason: 'Neither UCC filings nor public web evidence establishes deposit behavior. Ask directly about transaction volume, payments, fraud controls, balances, and service gaps.' });
  return result;
}
