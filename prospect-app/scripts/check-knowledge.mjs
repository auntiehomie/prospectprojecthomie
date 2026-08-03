import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadModule(path, exportNames) {
  const source = fs.readFileSync(path, 'utf8');
  const transformed = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJs = { exports: {} };
  const context = vm.createContext({ module: commonJs, exports: commonJs.exports, require, URL, crypto: globalThis.crypto, console, Date, Math, Intl, TextEncoder, Blob: globalThis.Blob });
  vm.runInContext(transformed, context, { filename: path });
  return Object.fromEntries(exportNames.map((name) => [name, commonJs.exports[name]]));
}

const { FLAGSTAR_PRODUCT_CATALOG } = loadModule('src/data/products.ts', ['FLAGSTAR_PRODUCT_CATALOG']);
const { validateEvidenceDraft, validateLlmAnalysis, validateWebResearch, normalizeUrl } = loadModule('src/data/knowledge.ts', ['validateEvidenceDraft', 'validateLlmAnalysis', 'validateWebResearch', 'normalizeUrl']);
const { DEFAULT_OPENROUTER_MODEL_CHAIN, resolveOpenRouterModelChain } = loadModule('src/data/model-routing.ts', ['DEFAULT_OPENROUTER_MODEL_CHAIN', 'resolveOpenRouterModelChain']);
const { buildDiscoveryLinks, summarizeQualification, assessEvidenceQuality, assessOutreachReadiness } = loadModule('src/data/prospect-research.ts', ['buildDiscoveryLinks', 'summarizeQualification', 'assessEvidenceQuality', 'assessOutreachReadiness']);

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(DEFAULT_OPENROUTER_MODEL_CHAIN[0].endsWith(':free'), 'Cost-first model chain must start with the free model.');
assert(DEFAULT_OPENROUTER_MODEL_CHAIN[1] === 'openai/gpt-5.6-sol', 'Research/orchestration fallback must be GPT-5.6 Sol.');
assert(DEFAULT_OPENROUTER_MODEL_CHAIN[2] === 'deepseek/deepseek-v4-pro', 'Coding/execution fallback must be DeepSeek V4 Pro.');
const overrideChain = resolveOpenRouterModelChain('openrouter/test/one, test/two, test/one');
assert(overrideChain.join(',') === 'test/one,test/two', 'Model-chain overrides must normalize and deduplicate IDs.');
const ids = FLAGSTAR_PRODUCT_CATALOG.products.map((product) => product.id);
assert(new Set(ids).size === ids.length, 'Product IDs must be unique.');
assert(FLAGSTAR_PRODUCT_CATALOG.status === 'draft', 'Catalog must remain draft until human-approved sources are recorded.');
for (const product of FLAGSTAR_PRODUCT_CATALOG.products) {
  assert(product.name && product.description, `${product.id}: name and description are required.`);
  assert(product.sourceUrls.length > 0, `${product.id}: source URL is required.`);
  assert(product.sourceVerified === false, `${product.id}: sourceVerified must remain false in the draft catalog.`);
}

const validDraft = {
  sourceType: 'official_registry', sourceName: 'Michigan LARA', sourceUrl: 'https://example.gov/record',
  title: 'Active entity', text: 'The entity is listed as active.', observedAt: '2026-08-02',
  verificationStatus: 'confirmed', confidence: 'high',
};
assert(validateEvidenceDraft(validDraft).length === 0, 'Valid evidence draft should pass.');
assert(validateEvidenceDraft({ ...validDraft, sourceUrl: 'javascript:alert(1)' }).length > 0, 'Unsafe URLs must fail.');
assert(validateEvidenceDraft({ ...validDraft, observedAt: 'August 2' }).length > 0, 'Invalid dates must fail.');

const result = validateLlmAnalysis({
  catalogVersion: FLAGSTAR_PRODUCT_CATALOG.version,
  recommendations: [{
    productId: ids[0], score: 75, rationale: 'Cited fit.', evidenceIds: ['e1'],
    missingInformation: ['Confirm volume'], cautions: ['Draft catalog'],
  }],
  overallCautions: ['Human review required'],
}, new Set(ids), new Set(['e1']));
assert(result.recommendations[0].evidenceIds[0] === 'e1', 'Valid cited recommendation should pass.');

let uncitedFailed = false;
try {
  validateLlmAnalysis({
    catalogVersion: FLAGSTAR_PRODUCT_CATALOG.version,
    recommendations: [{ productId: ids[0], score: 75, rationale: 'No cite.', evidenceIds: ['made-up'], missingInformation: [], cautions: [] }],
    overallCautions: [],
  }, new Set(ids), new Set(['e1']));
} catch { uncitedFailed = true; }
assert(uncitedFailed, 'Recommendations without valid citations must fail.');

const research = validateWebResearch({
  findings: [{
    title: 'Active entity', claim: 'The registry lists the entity as active.', sourceUrl: 'https://example.gov/entity/1',
    sourceName: 'Official registry', sourceType: 'official_registry', observedAt: '2026-08-02', confidence: 'high',
    matchReason: 'Exact name and city match.',
  }],
  unresolvedQuestions: [], cautions: ['Human review required'],
}, new Set([normalizeUrl('https://example.gov/entity/1')]));
assert(research.findings.length === 1, 'Cited web finding should pass.');
let uncitedResearchFailed = false;
try {
  validateWebResearch({
    findings: [{ title: 'Claim', claim: 'Unsupported.', sourceUrl: 'https://made-up.invalid/', sourceName: 'Unknown', sourceType: 'other', observedAt: '2026-08-02', confidence: 'low', matchReason: 'None' }],
    unresolvedQuestions: [], cautions: [],
  }, new Set([normalizeUrl('https://example.gov/entity/1')]));
} catch { uncitedResearchFailed = true; }
assert(uncitedResearchFailed, 'Web findings without returned citations must fail.');

const prospect = {
  'Business Name': 'Example Michigan Business LLC', Address: '123 Main St', City: 'Farmington Hills', State: 'MI', 'Zip Code': '48334',
  'PPP Lender': 'Example Bank', 'Total PPP Loan Amount': '$250,000', 'Total Forgiveness Amount': '$250,000', 'NAICS Code': '541110',
  'Nearest Closing Branch': 'Example branch', 'Nearest Branch Address': '456 Branch Rd', 'Distance to Closing Branch (mi)': '0.5',
  Phone: '248-555-0100', Email: 'info@example.test', 'Contact Source': 'Official website', 'Contact Note': 'Public business contact.',
};
const discoveryLinks = buildDiscoveryLinks(prospect);
assert(discoveryLinks.some((link) => link.id === 'x-search'), 'Discovery hub must include X public search.');
assert(discoveryLinks.some((link) => link.id === 'instagram-search'), 'Discovery hub must include Instagram public discovery.');
assert(discoveryLinks.some((link) => link.id === 'facebook-search'), 'Discovery hub must include Facebook public discovery.');
assert(discoveryLinks.some((link) => link.id === 'gdelt-news'), 'Discovery hub must include GDELT news.');
assert(discoveryLinks.some((link) => link.id === 'michigan-lara'), 'Discovery hub must include Michigan LARA.');
assert(discoveryLinks.every((link) => link.url.startsWith('https://')), 'Discovery links must use HTTPS.');

const unverifiedQualification = summarizeQualification(prospect, []);
assert(unverifiedQualification.revenueStatus === 'unverified', 'PPP amount and contacts must not verify annual revenue.');
assert(unverifiedQualification.reviewPriority === 'review_first', 'Scale/contact signals may prioritize review without verifying revenue.');
const revenueEvidence = [{
  id: 'revenue-1', prospectId: 'example', sourceType: 'official_website', sourceName: 'Public annual report', sourceUrl: 'https://example.test/report',
  title: 'Annual revenue above threshold', text: 'Annual revenue exceeds $150,000. Entity-match reason: exact name and domain match.',
  observedAt: '2026-08-03', addedAt: '2026-08-03T00:00:00.000Z', verificationStatus: 'confirmed', confidence: 'high',
}];
assert(summarizeQualification(prospect, revenueEvidence).revenueStatus === 'verified_over_150k', 'High-confidence confirmed source-attributed revenue evidence should support the threshold state.');
assert(summarizeQualification(prospect, [{ ...revenueEvidence[0], sourceType: 'social' }]).revenueStatus === 'unverified', 'Social claims alone must not verify revenue.');
assert(summarizeQualification(prospect, [{ ...revenueEvidence[0], sourceUrl: '' }]).revenueStatus === 'unverified', 'Revenue evidence without a source URL must remain unverified.');
assert(summarizeQualification(prospect, [{ ...revenueEvidence[0], confidence: 'medium' }]).revenueStatus === 'unverified', 'Revenue evidence below high confidence must remain unverified.');

const currentQuality = assessEvidenceQuality(revenueEvidence[0], new Date('2026-08-03T12:00:00Z'));
assert(currentQuality.freshness === 'current', 'New official-site evidence should be current.');
assert(currentQuality.entityMatchDocumented === true, 'Entity-match reasoning should be detected.');
const historicalQuality = assessEvidenceQuality({ ...revenueEvidence[0], id: 'ppp', sourceType: 'ppp_foia', observedAt: '2020-06-01' }, new Date('2026-08-03T12:00:00Z'));
assert(historicalQuality.freshness === 'unknown', 'PPP evidence should stay labeled as a historical program record.');

assert(assessOutreachReadiness({ contactState: 'unverified', suppressionStatus: 'unknown', humanReviewed: false, notes: '' }).ready === false, 'Unverified contact must block outreach readiness.');
assert(assessOutreachReadiness({ contactState: 'verified_public', suppressionStatus: 'do_not_contact', humanReviewed: true, notes: '' }).ready === false, 'Suppression must block outreach readiness.');
assert(assessOutreachReadiness({ contactState: 'verified_public', suppressionStatus: 'clear', humanReviewed: true, notes: '' }).ready === true, 'Verified public contact plus clear suppression and human review may be ready for human-led outreach.');

console.log(`Knowledge validation passed (${ids.length} draft product categories; ${discoveryLinks.length} public discovery paths).`);
