# Prospect Project Homie — Intelligence v2 design

**Date:** 2026-08-02
**Status:** implementation foundation approved by Amanda; external outreach remains human-controlled.

## Product direction

The next iteration should be an **evidence-backed research and decision-support system**, not a black-box model that guesses customers or makes autonomous outreach decisions.

The learning loop is:

1. **Load knowledge** — versioned Flagstar product catalog, eligibility notes, public source links, and allowed fit signals.
2. **Enrich a business** — collect legal-entity, website/social, news, ownership/agent, contact, and bank-relationship evidence as timestamped observations.
3. **Recommend** — deterministic rules rank product conversations and show the exact reasons and missing facts.
4. **Human review** — Amanda confirms entity matches, contacts, relationship evidence, product relevance, and outcome.
5. **Learn safely** — aggregate confirmed outcomes to adjust rule weights. Never train directly on unverified scraped text or protected/sensitive personal data.

## Evidence model

Every stored observation should include:

- `type`: legal status, owner/officer, resident agent, website, social profile, news, contact, bank relationship, product need, outcome
- `value`: structured claim
- `sourceUrl` and `sourceName`
- `observedAt`
- `confidence`: 0–100
- `verification`: unreviewed, confirmed, rejected, stale
- `matchReason`: name/address/domain/entity-ID rationale
- `expiresAt` or review cadence

Confidence is attached to each claim, not to an entire business. Conflicting claims remain visible.

## Comerica relationship policy

The app may say only:

- **Direct historical evidence** — e.g. the official PPP record names Comerica as lender.
- **Corroborating public evidence** — e.g. a business-authored public statement or documented payment relationship.
- **Weak signal / lead for review** — indirect evidence such as an old bank-sponsored event or public lien filing, where lawful and relevant.
- **Unknown** — no public evidence.

It must never translate these into “current Comerica customer” without authorized, current first-party confirmation. Absence of evidence is not evidence of absence.

## Enrichment workflow

### 1. Resolve the legal entity

- Start with Michigan LARA / MiBusiness Registry for entity status and filings.
- Capture entity ID, legal name, status, formation date, registered office, and resident agent exactly as shown.
- Treat a resident agent as a legal-service contact, **not automatically the owner or outreach contact**.
- Use OpenCorporates reconciliation or OpenRefine as a secondary normalization layer, preserving attribution and license requirements.
- Use GLEIF only when an LEI exists; it provides fuzzy name/address matching and parent/child relationships, but coverage is sparse for small local businesses.

### 2. Resolve the operating business

Search exact legal name + address/city, then DBA/trade name. Verify the official domain using at least two identifiers (address, phone, state entity, or linked official social account). Capture:

- website/domain and last successful check
- business description and NAICS confirmation
- locations and signs of closure/relocation
- official social accounts linked from the domain or clearly matching contact/address data

### 3. News and events

Use targeted exact-name searches with city/owner qualifiers. GDELT DOC 2.0 can provide JSON article lists and cross-language monitoring, but entity disambiguation is mandatory. Store headline, publisher, date, URL, match reason, and relevance—never full copyrighted article bodies.

Useful events: expansion, relocation, hiring, property purchase, equipment investment, ownership change, awards/contracts, closure/distress, cyber/fraud events, and payments modernization.

### 4. Contact discovery waterfall

Most efficient and defensible order:

1. Official business website contact/about/team pages and published role inboxes.
2. Michigan LARA filings for entity verification and principals where provided; resident agent is not presumed to be a sales contact.
3. Local chamber/member directories and professional licensing boards.
4. Official social profiles for a website or role confirmation.
5. Reputable enrichment provider only after the domain and person are resolved.
6. Email pattern inference only as an **unverified hypothesis**; verify before outreach and never send test email merely to see if it bounces.

Store source and verification date. Prefer business role addresses (`info@`, `office@`) when appropriate. Maintain suppression/opt-out status separately and never overwrite it during refresh.

### 5. Product fit

Initial explainable conversation categories:

- Business operating accounts / cash management foundation
- Treasury and payments discovery
- Merchant/payment acceptance discovery
- Working-capital or line-of-credit discovery
- Equipment/vehicle finance discovery
- Owner-occupied real-estate finance discovery
- SBA/business acquisition or expansion discovery
- Industry-specific needs review

These are conversation suggestions, not approvals, pricing, eligibility determinations, or financial advice. The product catalog must be verified against current official Flagstar material and internal policy before customer use. Flagstar’s public site was Cloudflare-blocked during this research run, so v2 deliberately uses generic categories pending a human-approved catalog.

## Architecture

### Phase A — local-first foundation (implemented now)

- versioned TypeScript rules and product categories
- explainable fit reasons per prospect
- historical relationship-evidence label based on the PPP lender field
- enrichment checklist and one-click research links
- browser-local feedback with JSON export

### Phase B — durable private store

Recommended deployment: Vercel + Neon/Postgres (or existing approved database), with authentication and row-level authorization.

Core tables:

- `businesses`
- `entity_aliases`
- `observations`
- `contacts`
- `relationship_evidence`
- `product_catalog_versions`
- `recommendations`
- `feedback_events`
- `outreach_events`
- `suppression_list`
- `enrichment_runs`

Do not place private notes, feedback, or outreach history in the browser-delivered static JSON.

### Phase C — controlled enrichment jobs

A queue processes one source adapter at a time with caching, rate limits, robots/terms compliance, and immutable provenance. Human review gates entity merges and owner/contact assertions.

### Phase D — measured learning

Start with calibrated rule weights, then learn from reviewed labels only. Use time-split validation and report precision at top K, contact validity, meeting conversion, source freshness, and false entity-match rate. Do not optimize on protected traits or proxies.

## Iterative improvements

1. Add authenticated review queue and durable evidence store.
2. Import a human-approved Flagstar product catalog with effective dates and source links.
3. Build Michigan LARA assisted lookup (manual deep link first; automate only if terms and technical controls permit).
4. Add official-domain resolver and social-link extraction.
5. Add GDELT exact-name news adapter with city/entity disambiguation.
6. Add contact waterfall and verification states.
7. Add map/geocoding only after address provenance and provider terms are settled.
8. Add outreach workflow with CAN-SPAM-compliant templates, suppression checks, and human approval.
9. Add evaluation dashboard and active-learning queue for uncertain records.

## Compliance and safeguards

- FTC guidance states CAN-SPAM applies to B2B commercial email: truthful headers/subjects, ad identification, postal address, clear opt-out, and timely opt-out handling are required.
- Automated calls/texts require a separate legal/compliance review; do not infer permission from a public phone number.
- Do not scrape or store authentication-gated social data contrary to platform terms.
- Do not use protected-class attributes or inferred sensitive traits for prioritization or product recommendations.
- Recommendations must be explainable and reviewed; underwriting and formal eligibility remain outside this app.

## Sources checked 2026-08-02

- Michigan LARA Corporations Division: https://www.michigan.gov/lara/bureau-list/cscl/corps
- MiBusiness Registry: https://mibusinessregistry.lara.state.mi.us/ (interactive security check prevented automated access)
- OpenCorporates API reference: https://api.opencorporates.com/documentation/API-Reference
- GLEIF API: https://www.gleif.org/en/lei-data/gleif-api
- GDELT DOC 2.0 API: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- FTC CAN-SPAM compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- Flagstar public homepage/about pages and search index: https://www.flagstar.com/ (business subpages were Cloudflare-blocked during this run; current catalog requires human verification)
