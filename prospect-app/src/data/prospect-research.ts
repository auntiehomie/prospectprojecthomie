import type { Prospect } from '@/data/types';
import type { EvidenceRecord, EvidenceSourceType } from '@/data/knowledge';

export type DiscoveryCategory = 'official' | 'social' | 'news' | 'registry' | 'directory';

export interface DiscoveryLink {
  id: string;
  label: string;
  category: DiscoveryCategory;
  url: string;
  guidance: string;
  automationPolicy: string;
}

export type RevenueQualificationStatus = 'verified_over_150k' | 'verified_below_150k' | 'unverified';
export type SignalState = 'present' | 'missing' | 'review';

export interface QualificationSignal {
  id: string;
  label: string;
  state: SignalState;
  detail: string;
}

export interface QualificationSummary {
  revenueStatus: RevenueQualificationStatus;
  revenueLabel: string;
  reviewPriority: 'review_first' | 'standard_review';
  reviewPriorityLabel: string;
  signals: QualificationSignal[];
  warnings: string[];
}

export type EvidenceFreshness = 'current' | 'aging' | 'stale' | 'unknown';

export interface EvidenceQuality {
  freshness: EvidenceFreshness;
  freshnessLabel: string;
  entityMatchDocumented: boolean;
  guidance: string;
}

export type ContactVerificationState = 'verified_public' | 'unverified' | 'missing';
export type SuppressionStatus = 'clear' | 'do_not_contact' | 'unknown';

export interface OutreachReadinessDraft {
  contactState: ContactVerificationState;
  suppressionStatus: SuppressionStatus;
  humanReviewed: boolean;
  notes: string;
}

export interface OutreachAssessment {
  ready: boolean;
  label: string;
  blockers: string[];
  reminders: string[];
}

const LARA_SEARCH_URL = 'https://mibusinessregistry.lara.state.mi.us/search/business';
const WEST_BLOOMFIELD_CHAMBER_URL = 'https://westbloomfieldchamber.com/chamber-member-directory/';
const FARMINGTON_CHAMBER_URL = 'https://www.gfachamber.com/members/';

const SOURCE_FRESHNESS_DAYS: Record<EvidenceSourceType, { current: number; stale: number }> = {
  ppp_foia: { current: 0, stale: 0 },
  official_registry: { current: 90, stale: 365 },
  official_website: { current: 90, stale: 180 },
  news: { current: 30, stale: 120 },
  social: { current: 30, stale: 90 },
  user_note: { current: 30, stale: 90 },
  other: { current: 60, stale: 180 },
};

export function buildDiscoveryLinks(prospect: Prospect): DiscoveryLink[] {
  const business = prospect['Business Name'].trim();
  const city = prospect.City.trim();
  const state = prospect.State.trim() || 'MI';
  const exactBusiness = `"${business}"`;
  const entityQuery = `${exactBusiness} "${city}" "${state}"`;
  const encodedEntity = encodeURIComponent(entityQuery);
  const gdeltQuery = encodeURIComponent(`${exactBusiness} ${city} Michigan`);

  return [
    {
      id: 'official-domain',
      label: 'Official website / domain',
      category: 'official',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${entityQuery} official website`)}`,
      guidance: 'Confirm the business using name plus city/address/domain before saving a claim.',
      automationPolicy: 'Public web search; cite the official page rather than the search result.',
    },
    {
      id: 'x-search',
      label: 'X public search',
      category: 'social',
      url: `https://x.com/search?q=${encodedEntity}&src=typed_query`,
      guidance: 'Look for an official account, recent activity, location, and a matching official domain.',
      automationPolicy: 'Use the official X API only with approved access. Do not bypass login or rate limits.',
    },
    {
      id: 'instagram-search',
      label: 'Instagram public discovery',
      category: 'social',
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${entityQuery}`)}`,
      guidance: 'Confirm the profile is the same entity using location, domain, phone, or address.',
      automationPolicy: 'Discovery link only. Do not scrape login-gated pages or bypass Meta controls.',
    },
    {
      id: 'facebook-search',
      label: 'Facebook public discovery',
      category: 'social',
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com ${entityQuery}`)}`,
      guidance: 'Prefer an official business Page and verify against another identifier.',
      automationPolicy: 'Discovery link only. Use approved Meta APIs if a production adapter is authorized.',
    },
    {
      id: 'google-news',
      label: 'Google News',
      category: 'news',
      url: `https://news.google.com/search?q=${gdeltQuery}`,
      guidance: 'Store only publisher, date, URL, headline/short paraphrase, and entity-match reason.',
      automationPolicy: 'Do not copy full article bodies. Respect publisher access controls.',
    },
    {
      id: 'gdelt-news',
      label: 'GDELT recent news',
      category: 'news',
      url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${gdeltQuery}&mode=artlist&format=html`,
      guidance: 'Disambiguate with city/state and a second identifier before accepting a result.',
      automationPolicy: 'Public GDELT discovery; retain provenance and only a concise paraphrase.',
    },
    {
      id: 'michigan-lara',
      label: 'Michigan LARA registry',
      category: 'registry',
      url: LARA_SEARCH_URL,
      guidance: `Search for “${business}”; confirm entity status and address. A resident agent is not automatically an owner.`,
      automationPolicy: 'Human-assisted official registry lookup; do not relabel a resident agent as owner.',
    },
    {
      id: 'west-bloomfield-chamber',
      label: 'West Bloomfield Chamber',
      category: 'directory',
      url: WEST_BLOOMFIELD_CHAMBER_URL,
      guidance: 'Search the member directory and verify any listing against the official site or registry.',
      automationPolicy: 'Public directory research; cite the listing and record its observed date.',
    },
    {
      id: 'farmington-chamber',
      label: 'Greater Farmington Chamber',
      category: 'directory',
      url: FARMINGTON_CHAMBER_URL,
      guidance: 'Search the member directory and verify any public business contact before use.',
      automationPolicy: 'Public directory research; no automated outreach.',
    },
  ];
}

export function summarizeQualification(
  prospect: Prospect,
  evidence: EvidenceRecord[],
): QualificationSummary {
  const pppAmount = parseMoney(prospect['Total PPP Loan Amount']);
  const hasPublicContact = Boolean(prospect.Phone.trim() || prospect.Email.trim());
  const hasOnlinePresence = evidence.some((item) =>
    item.verificationStatus === 'confirmed' &&
    (item.sourceType === 'official_website' || item.sourceType === 'social'),
  );
  const confirmedRevenueEvidence = evidence.filter((item) =>
    item.verificationStatus === 'confirmed' &&
    item.confidence === 'high' &&
    item.sourceUrl &&
    item.sourceType !== 'ppp_foia' &&
    item.sourceType !== 'social' &&
    item.sourceType !== 'user_note' &&
    hasRevenueLanguage(item),
  );
  const verifiedOver = confirmedRevenueEvidence.some((item) => hasOverThresholdLanguage(item));
  const verifiedBelow = confirmedRevenueEvidence.some((item) => hasBelowThresholdLanguage(item));
  const revenueStatus: RevenueQualificationStatus = verifiedOver
    ? 'verified_over_150k'
    : verifiedBelow
      ? 'verified_below_150k'
      : 'unverified';
  const reviewFirst = revenueStatus === 'verified_over_150k' || (pppAmount >= 150_000 && (hasOnlinePresence || hasPublicContact));

  return {
    revenueStatus,
    revenueLabel: revenueStatus === 'verified_over_150k'
      ? 'Reviewer-confirmed evidence supports $150k+'
      : revenueStatus === 'verified_below_150k'
        ? 'Reviewer-confirmed evidence indicates below $150k'
        : 'Revenue unverified',
    reviewPriority: reviewFirst ? 'review_first' : 'standard_review',
    reviewPriorityLabel: reviewFirst ? 'Review first' : 'Standard review',
    signals: [
      {
        id: 'historical-scale',
        label: 'Historical scale signal',
        state: pppAmount >= 150_000 ? 'present' : 'review',
        detail: pppAmount > 0
          ? `Historical PPP loan: ${formatMoney(pppAmount)}. This is not annual revenue proof.`
          : 'No PPP amount was recorded; use other lawful scale evidence.',
      },
      {
        id: 'online-presence',
        label: 'Confirmed online presence',
        state: hasOnlinePresence ? 'present' : 'missing',
        detail: hasOnlinePresence
          ? 'A reviewer-confirmed official website or social record is present.'
          : 'Add and confirm an official website or public official social profile.',
      },
      {
        id: 'contactability',
        label: 'Public contact signal',
        state: hasPublicContact ? 'review' : 'missing',
        detail: hasPublicContact
          ? 'A contact exists in the seed data; verify that it is public, current, and business-related.'
          : 'No phone or email is recorded; research a public business contact method.',
      },
      {
        id: 'revenue-evidence',
        label: '$150k revenue evidence',
        state: revenueStatus === 'verified_over_150k' ? 'present' : revenueStatus === 'verified_below_150k' ? 'review' : 'missing',
        detail: revenueStatus === 'unverified'
          ? 'No high-confidence reviewer-confirmed official/news/other public source with a URL supports the annual-revenue threshold.'
          : 'Revenue status is based on high-confidence confirmed source evidence and still requires normal compliance review.',
      },
    ],
    warnings: [
      'PPP amount, payroll, followers, posting activity, and website quality do not prove current annual revenue.',
      'Do not infer a current bank relationship, ownership, credit eligibility, or protected/sensitive traits.',
    ],
  };
}

export function assessEvidenceQuality(item: EvidenceRecord, asOf = new Date()): EvidenceQuality {
  if (item.sourceType === 'ppp_foia') {
    return {
      freshness: 'unknown',
      freshnessLabel: 'Historical program record',
      entityMatchDocumented: true,
      guidance: 'Useful as historical seed evidence only; it does not prove current operations, revenue, or bank relationship.',
    };
  }

  const observed = parseDateOnly(item.observedAt);
  const ageDays = observed ? Math.max(0, Math.floor((asOf.getTime() - observed.getTime()) / 86_400_000)) : null;
  const policy = SOURCE_FRESHNESS_DAYS[item.sourceType];
  const freshness: EvidenceFreshness = ageDays === null
    ? 'unknown'
    : ageDays <= policy.current
      ? 'current'
      : ageDays <= policy.stale
        ? 'aging'
        : 'stale';
  const entityMatchDocumented = /entity[- ]match|exact name|address match|domain match|phone match|city match/i.test(item.text);

  return {
    freshness,
    freshnessLabel: freshness === 'current'
      ? `Current (${ageDays}d old)`
      : freshness === 'aging'
        ? `Recheck soon (${ageDays}d old)`
        : freshness === 'stale'
          ? `Stale (${ageDays}d old)`
          : 'Date unavailable',
    entityMatchDocumented,
    guidance: sourceGuidance(item.sourceType),
  };
}

export function assessOutreachReadiness(draft: OutreachReadinessDraft): OutreachAssessment {
  const blockers: string[] = [];
  if (draft.contactState !== 'verified_public') blockers.push('Verify a current public business contact method.');
  if (draft.suppressionStatus === 'unknown') blockers.push('Check the suppression/opt-out record.');
  if (draft.suppressionStatus === 'do_not_contact') blockers.push('Do-not-contact/opt-out status blocks outreach.');
  if (!draft.humanReviewed) blockers.push('A human reviewer must approve the contact and context.');

  return {
    ready: blockers.length === 0,
    label: blockers.length === 0 ? 'Ready for human-led outreach' : 'Not ready for outreach',
    blockers,
    reminders: [
      'This app does not send email, calls, texts, or social messages.',
      'B2B commercial email must follow CAN-SPAM, including truthful headers, a physical address, and opt-out handling.',
      'A public phone number does not establish consent for automated calls or texts; use a separately approved process.',
      'Do not mention inferred revenue, ownership, or a guessed current bank relationship.',
    ],
  };
}

function sourceGuidance(sourceType: EvidenceSourceType): string {
  switch (sourceType) {
    case 'official_registry':
      return 'Confirm legal entity, status, and address; a resident agent is not automatically an owner.';
    case 'official_website':
      return 'Match domain plus business name and location; prefer the company’s own contact page.';
    case 'social':
      return 'Confirm the account is official using domain, location, address, or phone; avoid login-gated collection.';
    case 'news':
      return 'Keep publisher/date/URL and a short paraphrase; verify the entity with at least two identifiers.';
    case 'user_note':
      return 'Record who observed the information and retain enough source context for another reviewer.';
    case 'other':
      return 'Explain why this source is reliable and how it matches the business.';
    case 'ppp_foia':
      return 'Treat as historical seed evidence only.';
  }
}

function hasRevenueLanguage(item: EvidenceRecord): boolean {
  return /annual revenue|annual sales|yearly revenue|yearly sales|gross revenue|gross sales/i.test(`${item.title} ${item.text}`);
}

function hasOverThresholdLanguage(item: EvidenceRecord): boolean {
  const text = `${item.title} ${item.text}`;
  return /(?:annual revenue|annual sales|yearly revenue|yearly sales|gross revenue|gross sales)[^\n.]{0,80}(?:over|above|exceeds?|at least|>=|greater than)\s*\$?\s*150(?:,?000|k)\b/i.test(text)
    || /\$?\s*(?:1[5-9]\d|[2-9]\d\d)(?:,?000|k)\b[^\n.]{0,80}(?:annual revenue|annual sales|yearly revenue|yearly sales|gross revenue|gross sales)/i.test(text);
}

function hasBelowThresholdLanguage(item: EvidenceRecord): boolean {
  const text = `${item.title} ${item.text}`;
  return /(?:annual revenue|annual sales|yearly revenue|yearly sales|gross revenue|gross sales)[^\n.]{0,80}(?:under|below|less than|<)\s*\$?\s*150(?:,?000|k)\b/i.test(text);
}

function parseMoney(value: string): number {
  return Number.parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
