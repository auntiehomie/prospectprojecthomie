import type { Prospect } from '@/data/types';

export const KNOWLEDGE_STORAGE_VERSION = 1;
export const MAX_EVIDENCE_TEXT_LENGTH = 4_000;
export const MAX_EVIDENCE_ITEMS_PER_PROSPECT = 40;

export type EvidenceSourceType =
  | 'ppp_foia'
  | 'official_registry'
  | 'official_website'
  | 'news'
  | 'social'
  | 'user_note'
  | 'other';

export type VerificationStatus = 'unreviewed' | 'confirmed' | 'rejected' | 'stale';
export type EvidenceConfidence = 'high' | 'medium' | 'low';

export interface EvidenceRecord {
  id: string;
  prospectId: string;
  sourceType: EvidenceSourceType;
  sourceName: string;
  sourceUrl: string;
  title: string;
  text: string;
  observedAt: string;
  addedAt: string;
  verificationStatus: VerificationStatus;
  confidence: EvidenceConfidence;
}

export interface EvidenceDraft {
  sourceType: EvidenceSourceType;
  sourceName: string;
  sourceUrl: string;
  title: string;
  text: string;
  observedAt: string;
  verificationStatus: VerificationStatus;
  confidence: EvidenceConfidence;
}

export interface LlmProductRecommendation {
  productId: string;
  score: number;
  rationale: string;
  evidenceIds: string[];
  missingInformation: string[];
  cautions: string[];
}

export interface LlmAnalysisResult {
  catalogVersion: string;
  model: string;
  generatedAt: string;
  recommendations: LlmProductRecommendation[];
  overallCautions: string[];
}

export interface WebResearchFinding {
  title: string;
  claim: string;
  sourceUrl: string;
  sourceName: string;
  sourceType: Exclude<EvidenceSourceType, 'ppp_foia' | 'user_note'>;
  observedAt: string;
  confidence: EvidenceConfidence;
  matchReason: string;
}

export interface WebResearchResult {
  model: string;
  generatedAt: string;
  findings: WebResearchFinding[];
  unresolvedQuestions: string[];
  cautions: string[];
}

export function prospectId(prospect: Prospect): string {
  return `${prospect['Business Name']}|${prospect.Address}|${prospect['Zip Code']}`;
}

export function createEvidenceRecord(
  targetProspectId: string,
  draft: EvidenceDraft,
  id = globalThis.crypto?.randomUUID?.() ?? `evidence-${Date.now()}-${Math.random().toString(16).slice(2)}`,
): EvidenceRecord {
  const normalized = normalizeEvidenceDraft(draft);
  const errors = validateEvidenceDraft(normalized);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  return {
    id,
    prospectId: targetProspectId,
    ...normalized,
    addedAt: new Date().toISOString(),
  };
}

export function normalizeEvidenceDraft(draft: EvidenceDraft): EvidenceDraft {
  return {
    ...draft,
    sourceName: draft.sourceName.trim().slice(0, 160),
    sourceUrl: draft.sourceUrl.trim().slice(0, 2_000),
    title: draft.title.trim().slice(0, 200),
    text: draft.text.trim().slice(0, MAX_EVIDENCE_TEXT_LENGTH),
    observedAt: draft.observedAt.trim(),
  };
}

export function validateEvidenceDraft(draft: EvidenceDraft): string[] {
  const errors: string[] = [];
  if (!draft.sourceName.trim()) errors.push('Source name is required.');
  if (!draft.title.trim()) errors.push('Evidence title is required.');
  if (!draft.text.trim()) errors.push('Evidence text is required.');
  if (draft.text.trim().length > MAX_EVIDENCE_TEXT_LENGTH) {
    errors.push(`Evidence text must be ${MAX_EVIDENCE_TEXT_LENGTH.toLocaleString()} characters or fewer.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.observedAt)) {
    errors.push('Observed date must use YYYY-MM-DD.');
  }
  if (draft.sourceUrl && !isSafeHttpUrl(draft.sourceUrl)) {
    errors.push('Source URL must be a valid http:// or https:// URL.');
  }
  return errors;
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function baseProspectEvidence(prospect: Prospect): EvidenceRecord[] {
  const targetProspectId = prospectId(prospect);
  const lender = prospect['PPP Lender'].trim();
  const base: EvidenceRecord[] = [
    {
      id: 'seed-business-profile',
      prospectId: targetProspectId,
      sourceType: 'ppp_foia',
      sourceName: 'SBA PPP FOIA dataset',
      sourceUrl: 'https://data.sba.gov/dataset/ppp-foia',
      title: 'Historical PPP borrower record',
      text: [
        `Business: ${prospect['Business Name']}`,
        `Location: ${prospect.City}, ${prospect.State} ${prospect['Zip Code']}`,
        `NAICS: ${prospect['NAICS Code']}`,
        `PPP lender: ${lender || 'not recorded'}`,
        `PPP loan amount: ${prospect['Total PPP Loan Amount'] || 'not recorded'}`,
      ].join('\n'),
      observedAt: '2026-08-02',
      addedAt: '2026-08-02T00:00:00.000Z',
      verificationStatus: 'confirmed',
      confidence: 'high',
    },
  ];

  if (prospect['Contact Source'] || prospect['Contact Note']) {
    base.push({
      id: 'seed-contact-research',
      prospectId: targetProspectId,
      sourceType: 'other',
      sourceName: prospect['Contact Source'] || 'Existing prospect research',
      sourceUrl: isSafeHttpUrl(prospect['Contact Source']) ? prospect['Contact Source'] : '',
      title: 'Existing contact research note',
      text: prospect['Contact Note'] || 'A public contact method was recorded in the prospect dataset.',
      observedAt: '2026-08-02',
      addedAt: '2026-08-02T00:00:00.000Z',
      verificationStatus: 'unreviewed',
      confidence: 'medium',
    });
  }

  return base;
}

export function validateImportedEvidence(value: unknown): EvidenceRecord[] {
  if (!Array.isArray(value)) throw new Error('Imported evidence must be a JSON array.');
  if (value.length > MAX_EVIDENCE_ITEMS_PER_PROSPECT) {
    throw new Error(`Import is limited to ${MAX_EVIDENCE_ITEMS_PER_PROSPECT} evidence records at a time.`);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Record ${index + 1} is not an object.`);
    const record = item as Partial<EvidenceRecord>;
    const draft: EvidenceDraft = {
      sourceType: isSourceType(record.sourceType) ? record.sourceType : 'other',
      sourceName: stringValue(record.sourceName),
      sourceUrl: stringValue(record.sourceUrl),
      title: stringValue(record.title),
      text: stringValue(record.text),
      observedAt: stringValue(record.observedAt),
      verificationStatus: isVerificationStatus(record.verificationStatus)
        ? record.verificationStatus
        : 'unreviewed',
      confidence: isEvidenceConfidence(record.confidence) ? record.confidence : 'low',
    };
    const normalized = normalizeEvidenceDraft(draft);
    const errors = validateEvidenceDraft(normalized);
    if (errors.length > 0) throw new Error(`Record ${index + 1}: ${errors.join(' ')}`);

    return {
      id: stringValue(record.id) || `imported-${index + 1}`,
      prospectId: stringValue(record.prospectId),
      ...normalized,
      addedAt: validIsoDate(record.addedAt) ? record.addedAt : new Date().toISOString(),
    };
  });
}

export function validateWebResearch(
  value: unknown,
  citedUrls: Set<string>,
): Omit<WebResearchResult, 'model' | 'generatedAt'> {
  if (!value || typeof value !== 'object') throw new Error('Research response was not an object.');
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.findings)) throw new Error('Missing findings array.');
  if (!Array.isArray(candidate.unresolvedQuestions) || !Array.isArray(candidate.cautions)) {
    throw new Error('Missing research review fields.');
  }

  const findings = candidate.findings.slice(0, 12).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Finding ${index + 1} is invalid.`);
    const finding = item as Record<string, unknown>;
    const sourceUrl = stringValue(finding.sourceUrl).slice(0, 2_000);
    if (!isSafeHttpUrl(sourceUrl) || !citedUrls.has(normalizeUrl(sourceUrl))) {
      throw new Error(`Finding ${index + 1} does not cite a returned web-search source.`);
    }
    const sourceType = isResearchSourceType(finding.sourceType) ? finding.sourceType : 'other';
    const confidence = isEvidenceConfidence(finding.confidence) ? finding.confidence : 'low';
    const observedAt = stringValue(finding.observedAt);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) throw new Error(`Finding ${index + 1} has an invalid date.`);
    return {
      title: stringValue(finding.title).slice(0, 200),
      claim: stringValue(finding.claim).slice(0, MAX_EVIDENCE_TEXT_LENGTH),
      sourceUrl,
      sourceName: stringValue(finding.sourceName).slice(0, 160),
      sourceType,
      observedAt,
      confidence,
      matchReason: stringValue(finding.matchReason).slice(0, 1_000),
    };
  }).filter((finding) => finding.title && finding.claim && finding.sourceName);

  return {
    findings,
    unresolvedQuestions: stringArray(candidate.unresolvedQuestions).slice(0, 12),
    cautions: stringArray(candidate.cautions).slice(0, 12),
  };
}

export function validateLlmAnalysis(
  value: unknown,
  allowedProductIds: Set<string>,
  allowedEvidenceIds: Set<string>,
): Omit<LlmAnalysisResult, 'model' | 'generatedAt'> {
  if (!value || typeof value !== 'object') throw new Error('LLM response was not an object.');
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.catalogVersion !== 'string') throw new Error('Missing catalog version.');
  if (!Array.isArray(candidate.recommendations)) throw new Error('Missing recommendations array.');
  if (!Array.isArray(candidate.overallCautions)) throw new Error('Missing overall cautions array.');

  const recommendations = candidate.recommendations.slice(0, 8).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Recommendation ${index + 1} is invalid.`);
    const recommendation = item as Record<string, unknown>;
    const productId = stringValue(recommendation.productId);
    if (!allowedProductIds.has(productId)) throw new Error(`Unknown product ID: ${productId || '(empty)'}.`);
    const score = Number(recommendation.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`Recommendation ${index + 1} has an invalid score.`);
    }
    const evidenceIds = stringArray(recommendation.evidenceIds).filter((id) => allowedEvidenceIds.has(id));
    if (evidenceIds.length === 0) {
      throw new Error(`Recommendation ${index + 1} has no valid evidence citations.`);
    }
    return {
      productId,
      score: Math.round(score),
      rationale: stringValue(recommendation.rationale).slice(0, 1_000),
      evidenceIds,
      missingInformation: stringArray(recommendation.missingInformation).slice(0, 8),
      cautions: stringArray(recommendation.cautions).slice(0, 8),
    };
  });

  return {
    catalogVersion: candidate.catalogVersion,
    recommendations,
    overallCautions: stringArray(candidate.overallCautions).slice(0, 10),
  };
}

function isSourceType(value: unknown): value is EvidenceSourceType {
  return ['ppp_foia', 'official_registry', 'official_website', 'news', 'social', 'user_note', 'other'].includes(String(value));
}

function isResearchSourceType(value: unknown): value is WebResearchFinding['sourceType'] {
  return ['official_registry', 'official_website', 'news', 'social', 'other'].includes(String(value));
}

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return ['unreviewed', 'confirmed', 'rejected', 'stale'].includes(String(value));
}

function isEvidenceConfidence(value: unknown): value is EvidenceConfidence {
  return ['high', 'medium', 'low'].includes(String(value));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 500))
    : [];
}

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}
