'use client';

import { useMemo, useState } from 'react';
import type { Prospect } from '@/data/types';
import type { EvidenceRecord } from '@/data/knowledge';
import {
  assessEvidenceQuality,
  assessOutreachReadiness,
  buildDiscoveryLinks,
  summarizeQualification,
  type ContactVerificationState,
  type OutreachReadinessDraft,
  type SuppressionStatus,
} from '@/data/prospect-research';

type Props = {
  prospect: Prospect;
  evidence: EvidenceRecord[];
};

const CATEGORY_LABELS = {
  official: 'Official web',
  social: 'Public social',
  news: 'News',
  registry: 'Registry',
  directory: 'Directory',
};

const SIGNAL_LABELS = {
  present: 'Present',
  missing: 'Missing',
  review: 'Review',
};

function initialOutreachDraft(prospect: Prospect): OutreachReadinessDraft {
  return {
    contactState: prospect.Phone || prospect.Email ? 'unverified' : 'missing',
    suppressionStatus: 'unknown',
    humanReviewed: false,
    notes: '',
  };
}

export default function ProspectResearchControls({ prospect, evidence }: Props) {
  const links = useMemo(() => buildDiscoveryLinks(prospect), [prospect]);
  const qualification = useMemo(() => summarizeQualification(prospect, evidence), [prospect, evidence]);
  const [outreach, setOutreach] = useState<OutreachReadinessDraft>(() => initialOutreachDraft(prospect));
  const outreachAssessment = assessOutreachReadiness(outreach);

  function updateOutreach<K extends keyof OutreachReadinessDraft>(key: K, value: OutreachReadinessDraft[K]) {
    setOutreach((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="research-controls">
      <section className="intel-section research-control-card">
        <div className="research-control-heading">
          <div>
            <p className="intel-section-label">1 · Public-source discovery hub</p>
            <p className="intel-muted">Open a business-specific research path, confirm the entity, then save only a concise cited claim in the evidence ledger.</p>
          </div>
          <span className="intel-badge intel-badge-confirmed">No unrestricted scraping</span>
        </div>
        <div className="discovery-grid">
          {links.map((link) => (
            <article key={link.id} className="discovery-card">
              <div className="discovery-card-head">
                <span className={`source-category source-category-${link.category}`}>{CATEGORY_LABELS[link.category]}</span>
                <a href={link.url} target="_blank" rel="noreferrer">Open ↗</a>
              </div>
              <strong>{link.label}</strong>
              <p>{link.guidance}</p>
              <small>{link.automationPolicy}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="intel-section research-control-card">
        <div className="research-control-heading">
          <div>
            <p className="intel-section-label">2 · Explainable $150k qualification</p>
            <p className="intel-muted">Scale, online presence, contactability, and revenue are separate signals. Priority is not a revenue claim.</p>
          </div>
          <div className="qualification-badges">
            <span className={`qualification-status qualification-status-${qualification.revenueStatus}`}>{qualification.revenueLabel}</span>
            <span className={`qualification-priority qualification-priority-${qualification.reviewPriority}`}>{qualification.reviewPriorityLabel}</span>
          </div>
        </div>
        <div className="qualification-grid">
          {qualification.signals.map((signal) => (
            <article key={signal.id} className={`qualification-signal qualification-signal-${signal.state}`}>
              <div><strong>{signal.label}</strong><span>{SIGNAL_LABELS[signal.state]}</span></div>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
        <ul className="guardrail-list">
          {qualification.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </section>

      <section className="intel-section research-control-card">
        <div className="research-control-heading">
          <div>
            <p className="intel-section-label">3 · Evidence quality & freshness</p>
            <p className="intel-muted">Freshness is source-specific. A current page still needs a documented entity match and human verification.</p>
          </div>
          <span className="intel-badge intel-badge-partial">{evidence.length} item(s)</span>
        </div>
        <div className="quality-list">
          {evidence.map((item) => {
            const quality = assessEvidenceQuality(item);
            return (
              <article key={item.id} className="quality-row">
                <div className="quality-row-main">
                  <strong>{item.title}</strong>
                  <span>{item.sourceName}</span>
                </div>
                <div className="quality-flags">
                  <span className={`freshness freshness-${quality.freshness}`}>{quality.freshnessLabel}</span>
                  <span className={quality.entityMatchDocumented ? 'match match-documented' : 'match match-missing'}>
                    {quality.entityMatchDocumented ? 'Entity match documented' : 'Add entity-match reason'}
                  </span>
                </div>
                <p>{quality.guidance}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="intel-section research-control-card">
        <div className="research-control-heading">
          <div>
            <p className="intel-section-label">4 · Contact & outreach readiness</p>
            <p className="intel-muted">This is a reviewer checklist only. The app does not send email, calls, texts, or social messages.</p>
          </div>
          <span className={outreachAssessment.ready ? 'readiness readiness-ready' : 'readiness readiness-blocked'}>{outreachAssessment.label}</span>
        </div>
        <div className="outreach-grid">
          <label className="field">
            <span>Contact verification</span>
            <select value={outreach.contactState} onChange={(event) => updateOutreach('contactState', event.target.value as ContactVerificationState)}>
              <option value="missing">No contact found</option>
              <option value="unverified">Found, not verified</option>
              <option value="verified_public">Verified public business contact</option>
            </select>
          </label>
          <label className="field">
            <span>Suppression / opt-out</span>
            <select value={outreach.suppressionStatus} onChange={(event) => updateOutreach('suppressionStatus', event.target.value as SuppressionStatus)}>
              <option value="unknown">Not checked</option>
              <option value="clear">Checked — no suppression found</option>
              <option value="do_not_contact">Do not contact / opted out</option>
            </select>
          </label>
          <label className="check-field outreach-review-check">
            <input type="checkbox" checked={outreach.humanReviewed} onChange={(event) => updateOutreach('humanReviewed', event.target.checked)} />
            <span>Human reviewed contact and context</span>
          </label>
          <label className="field outreach-notes">
            <span>Reviewer note (not persisted)</span>
            <textarea rows={3} maxLength={500} value={outreach.notes} onChange={(event) => updateOutreach('notes', event.target.value)} placeholder="Public role inbox, source checked, intended human follow-up…" />
          </label>
        </div>
        {outreachAssessment.blockers.length ? (
          <div className="outreach-blockers"><strong>Resolve before outreach:</strong><ul>{outreachAssessment.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>
        ) : null}
        <ul className="guardrail-list">
          {outreachAssessment.reminders.map((reminder) => <li key={reminder}>{reminder}</li>)}
        </ul>
      </section>
    </div>
  );
}
