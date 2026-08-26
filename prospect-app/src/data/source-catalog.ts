export type SourceCatalogEntry = {
  id: string;
  name: string;
  url: string;
  purpose: 'business_discovery' | 'entity_verification' | 'branch_closure' | 'bank_relationship' | 'business_signal';
  access: 'official_api' | 'official_download' | 'assisted_public_search' | 'public_directory';
  automation: 'allowed' | 'review_required';
  notes: string;
};

export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  {
    id: 'fdic-locations', name: 'FDIC BankFind Location API',
    url: 'https://api.fdic.gov/banks/docs/', purpose: 'branch_closure', access: 'official_api', automation: 'allowed',
    notes: 'Canonical branch identity and location data. Compare effective-dated snapshots; do not infer a pending closure from a missing result alone.',
  },
  {
    id: 'occ-cas', name: 'OCC Corporate Applications Search',
    url: 'https://apps.occ.gov/CAS/', purpose: 'branch_closure', access: 'assisted_public_search', automation: 'review_required',
    notes: 'Use the filing and action status as the source of truth for national-bank closure events.',
  },
  {
    id: 'michigan-lara', name: 'Michigan MiBusiness Registry',
    url: 'https://mibusinessregistry.lara.state.mi.us/search/business', purpose: 'entity_verification', access: 'assisted_public_search', automation: 'review_required',
    notes: 'Verify legal name and active status. A resident agent is not automatically an owner or outreach contact.',
  },
  {
    id: 'sba-ppp', name: 'SBA PPP FOIA', url: 'https://data.sba.gov/dataset/ppp-foia',
    purpose: 'bank_relationship', access: 'official_download', automation: 'allowed',
    notes: 'Historical PPP lender evidence only; it does not establish a current deposit relationship.',
  },
  {
    id: 'sba-7a-504', name: 'SBA 7(a) and 504 FOIA', url: 'https://data.sba.gov/dataset/7a-504-foia',
    purpose: 'bank_relationship', access: 'official_download', automation: 'allowed',
    notes: 'Quarterly loan-level relationship evidence. Preserve approval date, lender, program and source file.',
  },
  {
    id: 'michigan-ucc', name: 'Michigan UCC Online', url: 'https://ucc.michigan.gov/ucc-search',
    purpose: 'bank_relationship', access: 'assisted_public_search', automation: 'review_required',
    notes: 'Use only the official public search. Record secured party and filing status; never bypass controls or bulk-harvest results.',
  },
  {
    id: 'openstreetmap', name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/',
    purpose: 'business_discovery', access: 'official_api', automation: 'allowed',
    notes: 'Discovery seed, not proof of legal identity or operating status. Follow ODbL attribution and public endpoint usage policies.',
  },
  {
    id: 'census-zbp', name: 'Census ZIP Code Business Patterns',
    url: 'https://www.census.gov/data/developers/data-sets/cbp-zbp/zbp-api.html', purpose: 'business_signal', access: 'official_api', automation: 'allowed',
    notes: 'Market-level establishment, employment and payroll context; it does not identify individual businesses.',
  },
];
