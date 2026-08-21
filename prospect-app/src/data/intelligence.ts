// ─── Prospect Intelligence Engine v2 ───────────────────────────────
// Self-contained, explainable PPP-seed prioritization engine.
// This baseline relies only on public prospect fields; source-attributed research
// and optional catalog comparison live in the evidence workspace.
//
// Architecture:
//  1. Industry classifier based on NAICS prefix
//  2. Product-fit scorer combining industry, loan size, distance, contact reachability
//  3. Comerica relationship evidence label (PPP lender = direct SBA FOIA evidence)
//  4. Enrichment checklist per prospect
//  5. In-memory feedback capture with local download
// ────────────────────────────────────────────────────────────────────

import type { Prospect } from '@/data/types';

// ─── Derived types ──────────────────────────────────────────────────

export type ConfidenceLabel = 'confirmed' | 'likely' | 'possible' | 'unverified';

export interface EvidenceItem {
  label: string;
  source: string;
  confidence: ConfidenceLabel;
  detail: string;
}

export interface FitFactor {
  label: string;
  score: number; // 0–1 normalised contribution
  detail: string;
}

export interface ProductFit {
  overallScore: number; // 0–1
  tier: 'high' | 'medium' | 'low';
  summary: string;
  factors: FitFactor[];
}

export interface EnrichmentField {
  key: string;
  label: string;
  present: boolean;
  enriched: boolean; // true when the value goes beyond the PPP record default
}

export interface EnrichmentStatus {
  fields: EnrichmentField[];
  completedCount: number;
  totalCount: number;
  percent: number;
}

export interface IntelligenceReport {
  businessName: string;
  address: string;
  productFit: ProductFit;
  comericaEvidence: EvidenceItem[];
  enrichment: EnrichmentStatus;
  generatedAt: string; // ISO-8601
}

export interface FeedbackEntry {
  businessName: string;
  address: string;
  recommendationId: string;
  timestamp: string;
  agreement: 'agree' | 'disagree' | 'partial' | 'skip';
  notes: string;
}

// ─── NAICS industry classifier ──────────────────────────────────────

const INDUSTRY_CLASSIFIER: Record<string, { label: string; baseFit: number }> = {
  '21': { label: 'Mining & Extraction', baseFit: 0.30 },
  '23': { label: 'Construction', baseFit: 0.50 },
  '31': { label: 'Manufacturing', baseFit: 0.55 },
  '32': { label: 'Manufacturing', baseFit: 0.55 },
  '33': { label: 'Manufacturing', baseFit: 0.55 },
  '42': { label: 'Wholesale Trade', baseFit: 0.45 },
  '44': { label: 'Retail Trade', baseFit: 0.55 },
  '45': { label: 'Retail Trade', baseFit: 0.55 },
  '48': { label: 'Transportation & Warehousing', baseFit: 0.50 },
  '49': { label: 'Transportation & Warehousing', baseFit: 0.50 },
  '51': { label: 'Information / Technology', baseFit: 0.50 },
  '52': { label: 'Finance & Insurance', baseFit: 0.65 },
  '53': { label: 'Real Estate', baseFit: 0.55 },
  '54': { label: 'Professional Services', baseFit: 0.70 },
  '55': { label: 'Management', baseFit: 0.65 },
  '56': { label: 'Admin / Support Services', baseFit: 0.60 },
  '61': { label: 'Education', baseFit: 0.55 },
  '62': { label: 'Healthcare', baseFit: 0.75 },
  '71': { label: 'Arts & Entertainment', baseFit: 0.40 },
  '72': { label: 'Hospitality / Food Services', baseFit: 0.55 },
  '81': { label: 'Other Services', baseFit: 0.50 },
};

// Healthcare sub-classifications bump fit further
const HIGH_FIT_NAICS_PREFIXES = [
  '621', '622', // physicians, dentists, hospitals
  '5412',       // accounting / CPA firms
  '5411',       // legal services
];

export function classifyIndustry(naicsCode: string): { label: string; baseFit: number } {
  const code = naicsCode.trim().replace(/\D/g, '');
  const prefix2 = code.slice(0, 2);
  const prefix3 = code.slice(0, 3);
  const entry = INDUSTRY_CLASSIFIER[prefix2];
  if (!entry) return { label: `NAICS ${prefix2}`, baseFit: 0.40 };

  // Bump fit for high-value NAICS sub-categories that rely heavily on branch banking
  const isHighFit = HIGH_FIT_NAICS_PREFIXES.some((prefix) => prefix3.startsWith(prefix) || code.startsWith(prefix));
  const adjustedFit = isHighFit ? Math.min(0.85, entry.baseFit + 0.10) : entry.baseFit;
  return { label: entry.label, baseFit: adjustedFit };
}

// ─── Product-fit scorer ─────────────────────────────────────────────

export function parseLoanAmount(value: string): number {
  return Number.parseFloat(value || '0') || 0;
}

export function parseDistance(value: string): number {
  return Number.parseFloat(value || '0') || 0;
}

/**
 * Returns a normalised 0–1 score from a value, given low/high thresholds.
 */
function clampScore(value: number, low: number, high: number): number {
  if (value <= low) return 0;
  if (value >= high) return 1;
  return (value - low) / (high - low);
}

export function scoreProductFit(prospect: Prospect): ProductFit {
  const loanAmount = parseLoanAmount(prospect['Total PPP Loan Amount']);
  const distance = parseDistance(prospect['Distance to Closing Branch (mi)']);
  const { label: industryLabel, baseFit } = classifyIndustry(prospect['NAICS Code']);
  const hasPhone = Boolean(prospect.Phone);
  const hasEmail = Boolean(prospect.Email);

  // ── Factor 1: Industry fit (weight: 0.30) ──
  const industryScore = baseFit;

  // ── Factor 2: Historical PPP amount seed signal (weight: 0.30) ──
  // $0 → $1M+  maps to 0→1
  const loanScore = clampScore(loanAmount, 50_000, 1_000_000);

  // ── Factor 3: Proximity to closing branch (weight: 0.25) ──
  // 0 mi (excellent) → 2 mi (farther) maps to 1→0
  const proximityScore = 1 - clampScore(distance, 0.05, 2.0);

  // ── Factor 4: Contact reachability (weight: 0.15) ──
  const contactScore = hasPhone && hasEmail ? 1.0 : hasPhone || hasEmail ? 0.5 : 0.2;

  const weights = { industry: 0.30, loan: 0.30, proximity: 0.25, contact: 0.15 };
  const overall =
    industryScore * weights.industry +
    loanScore * weights.loan +
    proximityScore * weights.proximity +
    contactScore * weights.contact;

  const tier: ProductFit['tier'] = overall >= 0.65 ? 'high' : overall >= 0.40 ? 'medium' : 'low';

  let summary: string;
  if (tier === 'high') {
    summary = `High-priority PPP seed — ${industryLabel} business with a larger historical PPP record, close branch proximity, and reachable contacts. Add current evidence before discussing products.`;
  } else if (tier === 'medium') {
    summary = `Medium-priority PPP seed — ${industryLabel} business. Add current operating, ownership, and needs evidence before outreach.`;
  } else {
    summary = `Lower-priority PPP seed — ${industryLabel} business. New source-attributed evidence may change its priority.`;
  }

  const factors: FitFactor[] = [
    {
      label: 'Industry',
      score: Math.round(industryScore * 100) / 100,
      detail: `${industryLabel} (NAICS ${prospect['NAICS Code']}) — base fit ${Math.round(baseFit * 100)}%`,
    },
    {
      label: 'Loan Size',
      score: Math.round(loanScore * 100) / 100,
      detail:
        loanAmount >= 500_000
          ? `Larger historical PPP loan (${formatCurrency(loanAmount)}) — stronger seed-size signal only`
          : loanAmount >= 100_000
            ? `Moderate historical PPP loan (${formatCurrency(loanAmount)}) — seed-size signal only`
            : `Smaller historical PPP loan (${formatCurrency(loanAmount)}) — seed-size signal only`,
    },
    {
      label: 'Proximity',
      score: Math.round(proximityScore * 100) / 100,
      detail:
        distance < 0.3
          ? `${distance.toFixed(2)} mi from closing branch — excellent proximity`
          : distance < 1.0
            ? `${distance.toFixed(2)} mi from closing branch — good proximity`
            : `${distance.toFixed(2)} mi from closing branch — moderate proximity`,
    },
    {
      label: 'Contactability',
      score: Math.round(contactScore * 100) / 100,
      detail:
        hasPhone && hasEmail
          ? 'Phone + email available — fully reachable'
          : hasPhone
            ? 'Phone only — partially reachable'
            : hasEmail
              ? 'Email only — partially reachable'
              : 'No public contact — requires manual discovery',
    },
  ];

  return { overallScore: Math.round(overall * 100) / 100, tier, summary, factors };
}

// ─── Comerica relationship evidence ─────────────────────────────────
// Only direct PPP lender field is used as evidence.
// No fabrications, no external lookups.

export function comericaEvidence(prospect: Prospect): EvidenceItem[] {
  const lender = (prospect['PPP Lender'] || '').trim();
  const loanText = formatCurrency(parseLoanAmount(prospect['Total PPP Loan Amount']));
  const forgivenText = formatCurrency(parseLoanAmount(prospect['Total Forgiveness Amount']));

  if (!lender) {
    return [
      {
        label: 'PPP Lender',
        source: 'SBA FOIA PPP dataset',
        confidence: 'unverified',
        detail: 'No lender recorded in PPP data.',
      },
    ];
  }

  const isComerica = lender.toLowerCase().includes('comerica');

  const items: EvidenceItem[] = [
    {
      label: 'PPP Lender',
      source: 'SBA FOIA PPP dataset',
      confidence: isComerica ? 'confirmed' : 'unverified',
      detail: isComerica
        ? `"${lender}" — direct match in SBA PPP FOIA data.`
        : `"${lender}" — not Comerica.`,
    },
  ];

  if (isComerica) {
    items.push({
      label: 'Loan Amount',
      source: 'SBA FOIA PPP dataset',
      confidence: 'confirmed',
      detail: `Total PPP loan: ${loanText} (${forgivenText} forgiven).`,
    });
  }

  return items;
}

// ─── Enrichment checklist ───────────────────────────────────────────

export function enrichmentStatus(prospect: Prospect): EnrichmentStatus {
  // Fields that originate from the PPP record are "present" but not "enriched".
  // Enriched = a human/script added value beyond the raw PPP fields.
  const fields: EnrichmentField[] = [
    {
      key: 'phone',
      label: 'Phone number',
      present: true,
      enriched: Boolean(prospect.Phone),
    },
    {
      key: 'email',
      label: 'Email address',
      present: true,
      enriched: Boolean(prospect.Email),
    },
    {
      key: 'contactSource',
      label: 'Contact source',
      present: true,
      enriched: Boolean(prospect['Contact Source']),
    },
    {
      key: 'contactNote',
      label: 'Contact note',
      present: true,
      enriched: Boolean(prospect['Contact Note']),
    },
    {
      key: 'nearestBranch',
      label: 'Nearest closing branch',
      present: true,
      enriched: Boolean(prospect['Nearest Closing Branch']),
    },
    {
      key: 'distance',
      label: 'Branch distance calculated',
      present: true,
      enriched: Boolean(prospect['Distance to Closing Branch (mi)']),
    },
  ];

  const completedCount = fields.filter((f) => f.enriched).length;
  return {
    fields,
    completedCount,
    totalCount: fields.length,
    percent: Math.round((completedCount / fields.length) * 100),
  };
}

// ─── Full intelligence report ───────────────────────────────────────

export function generateReport(prospect: Prospect): IntelligenceReport {
  return {
    businessName: prospect['Business Name'],
    address: `${prospect.Address}, ${prospect.City}, ${prospect.State} ${prospect['Zip Code']}`,
    productFit: scoreProductFit(prospect),
    comericaEvidence: comericaEvidence(prospect),
    enrichment: enrichmentStatus(prospect),
    generatedAt: new Date().toISOString(),
  };
}

export function generateReports(prospects: Prospect[]): IntelligenceReport[] {
  return prospects.map(generateReport);
}

// ─── Feedback capture (API-backed durable storage) ─────────────────
// Replaced in-memory store with API calls to /api/feedback.
// The old downloadFeedback() helper is preserved for export use cases.

const FEEDBACK_API = '/api/feedback';

async function feedbackApi(path: string, init?: RequestInit) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const code = typeof localStorage !== 'undefined' ? localStorage.getItem('prospectAccessCode') : null;
  if (code) headers['x-prospect-access-code'] = code;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`Feedback API error: ${res.status}`);
  return res.json();
}

export async function submitFeedback(
  businessName: string,
  address: string,
  recommendationId: string,
  agreement: FeedbackEntry['agreement'],
  notes: string,
): Promise<FeedbackEntry> {
  const entry = await feedbackApi(FEEDBACK_API, {
    method: 'POST',
    body: JSON.stringify({ businessName, address, recommendationId, agreement, notes: notes.trim().slice(0, 500) }),
  });
  return { ...entry, timestamp: entry.createdAt };
}

export async function getFeedback(businessName?: string): Promise<FeedbackEntry[]> {
  const url = businessName ? `${FEEDBACK_API}?businessName=${encodeURIComponent(businessName)}` : FEEDBACK_API;
  const entries = await feedbackApi(url);
  return entries.map((e: { createdAt: string }) => ({ ...e, timestamp: e.createdAt }));
}

// In-memory fallback for SSR contexts where fetch isn't available
let fallbackStore: FeedbackEntry[] = [];

export function submitFeedbackSync(
  businessName: string,
  address: string,
  recommendationId: string,
  agreement: FeedbackEntry['agreement'],
  notes: string,
): FeedbackEntry {
  const entry: FeedbackEntry = {
    businessName,
    address,
    recommendationId,
    timestamp: new Date().toISOString(),
    agreement,
    notes: notes.trim().slice(0, 500),
  };
  fallbackStore = [...fallbackStore, entry];
  return entry;
}

export function getFeedbackSync(): FeedbackEntry[] {
  return [...fallbackStore];
}

export function clearFeedback(): void {
  fallbackStore = [];
}

// Preserved: local download helper for exporting feedback as JSON
export function downloadFeedback(filename?: string): void {
  const entries = getFeedbackSync();
  const json = JSON.stringify(entries, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || `prospect-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Aggregate intelligence stats across all prospects */
export function aggregateStats(reports: IntelligenceReport[]) {
  const highFit = reports.filter((r) => r.productFit.tier === 'high').length;
  const mediumFit = reports.filter((r) => r.productFit.tier === 'medium').length;
  const lowFit = reports.filter((r) => r.productFit.tier === 'low').length;
  const avgEnrichment =
    reports.length > 0
      ? Math.round(
          reports.reduce(
            (sum, r) => sum + r.enrichment.percent,
            0,
          ) / reports.length,
        )
      : 0;
  const historicalComericaPpp = reports.filter(
    (r) => r.comericaEvidence.some((e) => e.confidence === 'confirmed'),
  ).length;

  return { highFit, mediumFit, lowFit, avgEnrichment, historicalComericaPpp, total: reports.length };
}
