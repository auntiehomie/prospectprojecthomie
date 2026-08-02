'use client';

import { useCallback, useState } from 'react';
import type { Prospect } from '@/data/types';
import {
  generateReport,
  submitFeedback,
  getFeedback,
  downloadFeedback,
  aggregateStats,
  type FeedbackEntry,
} from '@/data/intelligence';

type Props = {
  /** Single prospect to render intelligence for, or null to show aggregate summary */
  prospect: Prospect | null;
  /** Optional list of all prospects for aggregate view */
  allProspects?: Prospect[];
};

const CONFIDENCE_COLORS: Record<string, string> = {
  confirmed: '#0f6b4c',
  likely: '#b8860b',
  possible: '#7a6e3d',
  unverified: '#89958f',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  likely: 'Likely',
  possible: 'Possible',
  unverified: 'Unverified',
};

const TIER_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: '#dff3e9', text: '#084a35', label: 'High fit' },
  medium: { bg: '#fef3d6', text: '#7a5d00', label: 'Medium fit' },
  low: { bg: '#f3f5f4', text: '#607068', label: 'Lower fit' },
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ProspectIntelligence({ prospect, allProspects }: Props) {
  const report = prospect ? generateReport(prospect) : null;
  const allReports =
    allProspects && allProspects.length > 0 ? allProspects.map(generateReport) : null;

  const stats = allReports ? aggregateStats(allReports) : null;

  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackAgreement, setFeedbackAgreement] = useState<FeedbackEntry['agreement']>('skip');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitFeedback = useCallback(() => {
    if (!prospect) return;
    setSubmitting(true);
    submitFeedback(
      prospect['Business Name'],
      `${prospect.Address}, ${prospect.City}, ${prospect.State}`,
      `${prospect['Business Name']}-${prospect.Address}`,
      feedbackAgreement,
      feedbackNotes,
    );
    setFeedbackSubmitted(true);
    setTimeout(() => {
      setFeedbackSubmitted(false);
      setSubmitting(false);
      setFeedbackNotes('');
      setFeedbackAgreement('skip');
    }, 3000);
  }, [feedbackAgreement, feedbackNotes, prospect]);

  const handleDownloadFeedback = useCallback(() => {
    downloadFeedback();
  }, []);

  const feedbackEntries = getFeedback();

  // ── Empty state (no prospect selected) ──
  if (!report) {
    return (
      <section className="intelligence-panel">
        <div className="intel-header">
          <div>
            <p className="eyebrow">Intelligence v2</p>
            <h2>Product-fit recommendations</h2>
          </div>
        </div>

        {stats ? (
          <div className="intel-stats-grid">
            <div className="intel-stat intel-stat-high">
              <strong>{stats.highFit}</strong>
              <span>high fit</span>
            </div>
            <div className="intel-stat intel-stat-med">
              <strong>{stats.mediumFit}</strong>
              <span>medium fit</span>
            </div>
            <div className="intel-stat intel-stat-low">
              <strong>{stats.lowFit}</strong>
              <span>lower fit</span>
            </div>
            <div className="intel-stat">
              <strong>{stats.avgEnrichment}%</strong>
              <span>avg enrichment</span>
            </div>
            <div className="intel-stat">
              <strong>{stats.confirmedRel}/{stats.total}</strong>
              <span>Comerica confirmed</span>
            </div>
          </div>
        ) : null}

        <div className="intel-placeholder">
          <p>Select a business from the table below to see detailed product-fit intelligence, evidence, and enrichment status.</p>
        </div>

        {feedbackEntries.length > 0 ? (
          <div className="intel-feedback-summary">
            <p className="intel-section-label">Captured feedback</p>
            <p className="intel-muted">
              {feedbackEntries.length} feedback
              {feedbackEntries.length === 1 ? ' entry' : ' entries'} captured this session.
            </p>
            <button type="button" className="button secondary" onClick={handleDownloadFeedback}>
              Download feedback JSON
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  // ── Detail view ──
  const tierBadge = TIER_BADGES[report.productFit.tier];

  return (
    <section className="intelligence-panel">
      <div className="intel-header">
        <div>
          <p className="eyebrow">Intelligence v2 — {report.businessName}</p>
          <h2>Product-fit & evidence</h2>
        </div>
        <span
          className="intel-tier-badge"
          style={{ background: tierBadge.bg, color: tierBadge.text }}
        >
          {tierBadge.label} ({formatPercent(report.productFit.overallScore)})
        </span>
      </div>

      {/* ── Product-fit summary ── */}
      <p className="intel-summary">{report.productFit.summary}</p>

      {/* ── Fit factors (explainable breakdown) ── */}
      <div className="intel-section">
        <p className="intel-section-label">Fit factor breakdown</p>
        <div className="intel-factors">
          {report.productFit.factors.map((factor) => (
            <div key={factor.label} className="intel-factor">
              <div className="intel-factor-head">
                <span className="intel-factor-label">{factor.label}</span>
                <span className="intel-factor-score">{formatPercent(factor.score)}</span>
              </div>
              <div className="intel-factor-bar-wrap">
                <div
                  className="intel-factor-bar"
                  style={{ width: formatPercent(factor.score) }}
                />
              </div>
              <p className="intel-factor-detail">{factor.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Comerica evidence ── */}
      <div className="intel-section">
        <p className="intel-section-label">
          Comerica relationship evidence
          <span className="intel-badge intel-badge-confirmed">PPP FOIA data only</span>
        </p>
        <div className="intel-evidence-list">
          {report.comericaEvidence.map((item, idx) => (
            <div key={idx} className="intel-evidence-item">
              <div className="intel-evidence-head">
                <strong>{item.label}</strong>
                <span
                  className="intel-confidence-pill"
                  style={{ background: CONFIDENCE_COLORS[item.confidence] + '18', color: CONFIDENCE_COLORS[item.confidence] }}
                >
                  {CONFIDENCE_LABELS[item.confidence]}
                </span>
              </div>
              <p className="intel-evidence-source">Source: {item.source}</p>
              <p className="intel-evidence-detail">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Enrichment checklist ── */}
      <div className="intel-section">
        <p className="intel-section-label">
          Enrichment completion
          <span className={`intel-badge ${report.enrichment.percent === 100 ? 'intel-badge-done' : 'intel-badge-partial'}`}>
            {report.enrichment.completedCount}/{report.enrichment.totalCount}
          </span>
        </p>
        <div className="intel-enrichment-bar-wrap">
          <div
            className="intel-enrichment-bar"
            style={{ width: `${report.enrichment.percent}%` }}
          />
        </div>
        <ul className="intel-checklist">
          {report.enrichment.fields.map((field) => (
            <li key={field.key} className={field.enriched ? 'checked' : ''}>
              <span className="intel-checkmark">{field.enriched ? '✓' : '○'}</span>
              <span className={field.enriched ? '' : 'intel-muted'}>{field.label}</span>
              {field.enriched ? (
                <span className="intel-check-status done">enriched</span>
              ) : (
                <span className="intel-check-status missing">missing</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Local feedback capture ── */}
      <div className="intel-section">
        <p className="intel-section-label">Session feedback</p>
        <p className="intel-muted">
          Rate this recommendation. All feedback stays in your browser this session.
          Nothing is stored or sent anywhere.
        </p>

        {feedbackSubmitted ? (
          <div className="intel-feedback-confirmed">
            ✓ Feedback captured. Thank you.
          </div>
        ) : (
          <div className="intel-feedback-form">
            <div className="intel-agreement-row">
              {(['agree', 'partial', 'disagree', 'skip'] as const).map((agreement) => (
                <button
                  key={agreement}
                  type="button"
                  className={`intel-agreement-btn ${feedbackAgreement === agreement ? 'selected' : ''}`}
                  onClick={() => setFeedbackAgreement(agreement)}
                >
                  {agreement === 'agree'
                    ? '✓ Agree'
                    : agreement === 'partial'
                      ? '~ Partially agree'
                      : agreement === 'disagree'
                        ? '✗ Disagree'
                        : 'Skip'}
                </button>
              ))}
            </div>
            <textarea
              className="intel-feedback-textarea"
              rows={3}
              placeholder="Optional notes (max 500 characters)..."
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              maxLength={500}
            />
            <button
              type="button"
              className="button primary"
              onClick={handleSubmitFeedback}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Capture feedback'}
            </button>
          </div>
        )}
      </div>

      {/* ── Download feedback (shown when anything is captured) ── */}
      {feedbackEntries.length > 0 ? (
        <div className="intel-feedback-summary">
          <span>
            {feedbackEntries.length} feedback
            {feedbackEntries.length === 1 ? ' entry' : ' entries'} captured this session.
          </span>
          <button type="button" className="button secondary" onClick={handleDownloadFeedback}>
            Download feedback JSON
          </button>
        </div>
      ) : null}

      {/* ── Meta ── */}
      <p className="intel-meta">
        Report generated {new Date(report.generatedAt).toLocaleString()}
      </p>
    </section>
  );
}