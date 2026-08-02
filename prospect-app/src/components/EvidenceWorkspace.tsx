'use client';

import { useMemo, useState } from 'react';
import type { Prospect } from '@/data/types';
import {
  KNOWLEDGE_STORAGE_VERSION,
  MAX_EVIDENCE_ITEMS_PER_PROSPECT,
  baseProspectEvidence,
  createEvidenceRecord,
  prospectId,
  validateImportedEvidence,
  type EvidenceConfidence,
  type EvidenceDraft,
  type EvidenceRecord,
  type EvidenceSourceType,
  type LlmAnalysisResult,
  type VerificationStatus,
  type WebResearchResult,
} from '@/data/knowledge';
import { FLAGSTAR_PRODUCT_CATALOG } from '@/data/products';

type Props = { prospect: Prospect };

const SOURCE_LABELS: Record<EvidenceSourceType, string> = {
  ppp_foia: 'PPP FOIA',
  official_registry: 'Official registry',
  official_website: 'Official website',
  news: 'News',
  social: 'Official social',
  user_note: 'Your note/document',
  other: 'Other public source',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(): EvidenceDraft {
  return {
    sourceType: 'user_note',
    sourceName: '',
    sourceUrl: '',
    title: '',
    text: '',
    observedAt: today(),
    verificationStatus: 'unreviewed',
    confidence: 'medium',
  };
}

function storageKey(targetProspectId: string) {
  return `prospect-homie:evidence:v${KNOWLEDGE_STORAGE_VERSION}:${targetProspectId}`;
}

export default function EvidenceWorkspace({ prospect }: Props) {
  const targetProspectId = useMemo(() => prospectId(prospect), [prospect]);
  const seedEvidence = useMemo(() => baseProspectEvidence(prospect), [prospect]);
  const [localEvidence, setLocalEvidence] = useState<EvidenceRecord[]>(() => loadEvidence(targetProspectId));
  const [draft, setDraft] = useState<EvidenceDraft>(emptyDraft);
  const [message, setMessage] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<LlmAnalysisResult | null>(null);
  const [research, setResearch] = useState<WebResearchResult | null>(null);
  const [researching, setResearching] = useState(false);

  function persist(items: EvidenceRecord[]) {
    localStorage.setItem(storageKey(targetProspectId), JSON.stringify(items));
    setLocalEvidence(items);
  }

  function updateDraft<K extends keyof EvidenceDraft>(key: K, value: EvidenceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addEvidence() {
    try {
      if (localEvidence.length >= MAX_EVIDENCE_ITEMS_PER_PROSPECT) {
        throw new Error(`This local workspace is limited to ${MAX_EVIDENCE_ITEMS_PER_PROSPECT} added records per business.`);
      }
      const record = createEvidenceRecord(targetProspectId, draft);
      persist([...localEvidence, record]);
      setDraft(emptyDraft());
      setAnalysis(null);
      setMessage('Evidence saved in this browser. Export a JSON backup if you need to move it elsewhere.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add evidence.');
    }
  }

  async function readTextFile(file: File | undefined) {
    if (!file) return;
    const allowed = ['text/plain', 'text/csv', 'text/markdown', 'application/json'];
    if (file.size > 250_000) {
      setMessage('File is too large. Use a text excerpt under 250 KB.');
      return;
    }
    if (file.type && !allowed.includes(file.type) && !/\.(txt|md|csv|json)$/i.test(file.name)) {
      setMessage('Use a .txt, .md, .csv, or .json text file. PDF/DOCX parsing is not enabled yet.');
      return;
    }
    const text = await file.text();
    setDraft((current) => ({
      ...current,
      title: current.title || file.name,
      sourceName: current.sourceName || `Uploaded text: ${file.name}`,
      sourceType: 'user_note',
      text: text.slice(0, 4_000),
    }));
    setMessage(text.length > 4_000 ? 'Loaded the first 4,000 characters. Summarize or split the rest into cited records.' : 'Text loaded. Review it before saving.');
  }

  function removeEvidence(id: string) {
    persist(localEvidence.filter((item) => item.id !== id));
    setAnalysis(null);
    setMessage('Local evidence removed.');
  }

  function downloadEvidence() {
    downloadJson(
      {
        format: 'prospect-homie-evidence',
        version: KNOWLEDGE_STORAGE_VERSION,
        prospect: {
          id: targetProspectId,
          businessName: prospect['Business Name'],
          address: `${prospect.Address}, ${prospect.City}, ${prospect.State} ${prospect['Zip Code']}`,
        },
        exportedAt: new Date().toISOString(),
        evidence: localEvidence,
      },
      `prospect-evidence-${slug(prospect['Business Name'])}-${today()}.json`,
    );
  }

  async function importEvidence(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 500_000) throw new Error('Import must be under 500 KB.');
      const parsed = JSON.parse(await file.text()) as unknown;
      const payload = parsed && typeof parsed === 'object' && 'evidence' in parsed
        ? (parsed as { evidence: unknown }).evidence
        : parsed;
      const imported = validateImportedEvidence(payload).map((item) => ({ ...item, prospectId: targetProspectId }));
      const merged = dedupeEvidence([...localEvidence, ...imported]).slice(0, MAX_EVIDENCE_ITEMS_PER_PROSPECT);
      persist(merged);
      setAnalysis(null);
      setMessage(`Imported ${merged.length - localEvidence.length} new evidence record(s) into this browser.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import evidence JSON.');
    }
  }

  async function researchBusiness() {
    setResearching(true);
    setMessage('');
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessCode ? { 'X-Prospect-Access-Code': accessCode } : {}),
        },
        body: JSON.stringify({
          businessName: prospect['Business Name'],
          address: prospect.Address,
          city: prospect.City,
          state: prospect.State,
          zipCode: prospect['Zip Code'],
          naicsCode: prospect['NAICS Code'],
        }),
      });
      const payload = (await response.json()) as WebResearchResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Research failed.');
      setResearch(payload);
      setMessage('Research draft complete. Review every entity match and source before adding findings to the evidence ledger.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Research failed.');
    } finally {
      setResearching(false);
    }
  }

  function addResearchFinding(index: number) {
    const finding = research?.findings[index];
    if (!finding) return;
    try {
      const record = createEvidenceRecord(targetProspectId, {
        sourceType: finding.sourceType,
        sourceName: finding.sourceName,
        sourceUrl: finding.sourceUrl,
        title: finding.title,
        text: `${finding.claim}\n\nEntity-match reason: ${finding.matchReason}`,
        observedAt: finding.observedAt,
        verificationStatus: 'unreviewed',
        confidence: finding.confidence,
      });
      if (localEvidence.length >= MAX_EVIDENCE_ITEMS_PER_PROSPECT) {
        throw new Error(`This local workspace is limited to ${MAX_EVIDENCE_ITEMS_PER_PROSPECT} added records per business.`);
      }
      persist([...localEvidence, record]);
      setResearch((current) => current ? { ...current, findings: current.findings.filter((_, findingIndex) => findingIndex !== index) } : current);
      setAnalysis(null);
      setMessage('Research finding added as unreviewed evidence. Confirm it before relying on it.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add research finding.');
    }
  }

  async function compareWithCatalog() {
    setAnalyzing(true);
    setMessage('');
    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessCode ? { 'X-Prospect-Access-Code': accessCode } : {}),
        },
        body: JSON.stringify({
          prospect: {
            businessName: prospect['Business Name'],
            city: prospect.City,
            state: prospect.State,
            naicsCode: prospect['NAICS Code'],
          },
          evidence: [...seedEvidence, ...localEvidence],
        }),
      });
      const payload = (await response.json()) as LlmAnalysisResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Comparison failed.');
      setAnalysis(payload);
      setMessage('LLM comparison complete. Treat it as a cited draft for human review—not as a verified fact or offer.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Comparison failed.');
    } finally {
      setAnalyzing(false);
    }
  }

  const allEvidence = [...seedEvidence, ...localEvidence];
  const evidenceById = new Map(allEvidence.map((item) => [item.id, item]));

  return (
    <div className="evidence-workspace">
      <div className="intel-section">
        <p className="intel-section-label">Evidence intake</p>
        <p className="intel-muted">
          PPP is the seed—not the boundary. Add registry findings, official-site excerpts, news, official social posts, or your own notes. Each record keeps its source and review state.
        </p>
        <div className="evidence-form-grid">
          <label className="field">
            <span>Source type</span>
            <select value={draft.sourceType} onChange={(event) => updateDraft('sourceType', event.target.value as EvidenceSourceType)}>
              {Object.entries(SOURCE_LABELS).filter(([key]) => key !== 'ppp_foia').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Observed date</span>
            <input type="date" value={draft.observedAt} onChange={(event) => updateDraft('observedAt', event.target.value)} />
          </label>
          <label className="field">
            <span>Confidence</span>
            <select value={draft.confidence} onChange={(event) => updateDraft('confidence', event.target.value as EvidenceConfidence)}>
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </label>
          <label className="field">
            <span>Review status</span>
            <select value={draft.verificationStatus} onChange={(event) => updateDraft('verificationStatus', event.target.value as VerificationStatus)}>
              <option value="unreviewed">Unreviewed</option><option value="confirmed">Confirmed by reviewer</option><option value="rejected">Rejected</option><option value="stale">Stale</option>
            </select>
          </label>
          <label className="field evidence-wide">
            <span>Source / publisher *</span>
            <input value={draft.sourceName} onChange={(event) => updateDraft('sourceName', event.target.value)} placeholder="Michigan LARA, company website, local news, your name…" />
          </label>
          <label className="field evidence-wide">
            <span>Source URL (recommended)</span>
            <input type="url" value={draft.sourceUrl} onChange={(event) => updateDraft('sourceUrl', event.target.value)} placeholder="https://…" />
          </label>
          <label className="field evidence-wide">
            <span>Evidence title *</span>
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Active Michigan entity; announced second location; owner listed…" />
          </label>
          <label className="field evidence-wide">
            <span>Quoted fact, excerpt, or research note *</span>
            <textarea rows={6} maxLength={4_000} value={draft.text} onChange={(event) => updateDraft('text', event.target.value)} placeholder="Paste only the relevant passage or write a concise note. Include enough context for another reviewer to verify it." />
          </label>
          <label className="field evidence-wide">
            <span>Load a text file (optional)</span>
            <input type="file" accept=".txt,.md,.csv,.json,text/plain,text/csv,text/markdown,application/json" onChange={(event) => void readTextFile(event.target.files?.[0])} />
          </label>
        </div>
        <div className="evidence-actions">
          <button type="button" className="button primary" onClick={addEvidence}>Add cited evidence</button>
          <label className="button secondary file-button">Import evidence JSON<input type="file" accept="application/json,.json" onChange={(event) => void importEvidence(event.target.files?.[0])} /></label>
          <button type="button" className="button secondary" onClick={downloadEvidence} disabled={!localEvidence.length}>Export evidence JSON</button>
        </div>
        {message ? <p className="evidence-message" role="status">{message}</p> : null}
      </div>

      <div className="intel-section">
        <p className="intel-section-label">Evidence ledger <span className="intel-badge intel-badge-partial">{allEvidence.length} cited item(s)</span></p>
        <div className="intel-evidence-list">
          {allEvidence.map((item) => (
            <article key={item.id} className="intel-evidence-item">
              <div className="intel-evidence-head">
                <strong>{item.title}</strong>
                <span className="intel-confidence-pill">{item.confidence} · {item.verificationStatus}</span>
              </div>
              <p className="intel-evidence-source">{SOURCE_LABELS[item.sourceType]} · {item.sourceName} · {item.observedAt}</p>
              <p className="intel-evidence-detail evidence-prewrap">{item.text}</p>
              <div className="evidence-card-actions">
                {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a> : <span>No URL supplied</span>}
                {localEvidence.some((local) => local.id === item.id) ? <button type="button" onClick={() => removeEvidence(item.id)}>Remove local item</button> : <span>Seed record</span>}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="intel-section llm-compare">
        <p className="intel-section-label">Optional cited web research</p>
        <p className="intel-muted">When configured, OpenRouter web search looks for official registry/site, reputable news, and official social evidence. Returned findings are drafts and are not added until you review each one.</p>
        <div className="evidence-actions">
          <label className="field access-code-field">
            <span>App access code (if configured)</span>
            <input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="off" />
          </label>
          <button type="button" className="button primary" onClick={researchBusiness} disabled={researching}>{researching ? 'Researching…' : 'Research this business'}</button>
        </div>
        {research ? (
          <div className="llm-results">
            {research.findings.length ? research.findings.map((finding, index) => (
              <article key={`${finding.sourceUrl}-${finding.title}`} className="llm-result-card">
                <div className="intel-evidence-head"><strong>{finding.title}</strong><span className="intel-confidence-pill">{finding.confidence}</span></div>
                <p>{finding.claim}</p>
                <p className="intel-evidence-source">{finding.sourceName} · {finding.observedAt}</p>
                <p><b>Entity match:</b> {finding.matchReason}</p>
                <div className="evidence-card-actions"><a href={finding.sourceUrl} target="_blank" rel="noreferrer">Review source ↗</a><button type="button" onClick={() => addResearchFinding(index)}>Add as unreviewed evidence</button></div>
              </article>
            )) : <p className="intel-muted">No sufficiently cited finding was returned.</p>}
            {research.unresolvedQuestions.length ? <p className="intel-muted"><b>Unresolved:</b> {research.unresolvedQuestions.join('; ')}</p> : null}
            {research.cautions.length ? <p className="intel-muted"><b>Cautions:</b> {research.cautions.join('; ')}</p> : null}
            <p className="intel-meta">Generated {new Date(research.generatedAt).toLocaleString()} using {research.model}</p>
          </div>
        ) : null}
      </div>

      <div className="intel-section llm-compare">
        <p className="intel-section-label">Optional LLM comparison <span className="intel-badge intel-badge-partial">catalog {FLAGSTAR_PRODUCT_CATALOG.version}</span></p>
        <p className="intel-muted">The server sends the cited evidence and draft product catalog to the configured LLM. Every recommendation must cite evidence IDs. The result is not saved automatically.</p>
        <div className="evidence-actions">
          <label className="field access-code-field">
            <span>App access code (if configured)</span>
            <input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="off" />
          </label>
          <button type="button" className="button primary" onClick={compareWithCatalog} disabled={analyzing || allEvidence.length === 0}>{analyzing ? 'Comparing…' : 'Compare evidence to products'}</button>
        </div>
        {analysis ? (
          <div className="llm-results">
            {analysis.recommendations.length ? analysis.recommendations.map((recommendation) => {
              const product = FLAGSTAR_PRODUCT_CATALOG.products.find((item) => item.id === recommendation.productId);
              return (
                <article key={recommendation.productId} className="llm-result-card">
                  <div className="intel-evidence-head"><strong>{product?.name ?? recommendation.productId}</strong><span className="intel-tier-badge">{recommendation.score}/100</span></div>
                  <p>{recommendation.rationale}</p>
                  <p className="intel-evidence-source">Cites: {recommendation.evidenceIds.map((id) => evidenceById.get(id)?.title ?? id).join('; ')}</p>
                  {recommendation.missingInformation.length ? <p><b>Verify next:</b> {recommendation.missingInformation.join('; ')}</p> : null}
                  {recommendation.cautions.length ? <p><b>Cautions:</b> {recommendation.cautions.join('; ')}</p> : null}
                </article>
              );
            }) : <p className="intel-muted">The model found insufficient cited evidence for a product recommendation.</p>}
            {analysis.overallCautions.length ? <p className="intel-muted"><b>Overall cautions:</b> {analysis.overallCautions.join('; ')}</p> : null}
            <p className="intel-meta">Generated {new Date(analysis.generatedAt).toLocaleString()} using {analysis.model}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function loadEvidence(targetProspectId: string): EvidenceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(targetProspectId));
    return raw
      ? validateImportedEvidence(JSON.parse(raw)).map((item) => ({ ...item, prospectId: targetProspectId }))
      : [];
  } catch {
    return [];
  }
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function dedupeEvidence(items: EvidenceRecord[]) {
  const byId = new Map<string, EvidenceRecord>();
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()];
}
