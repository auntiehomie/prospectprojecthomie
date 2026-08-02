export type ProductCategory =
  | 'operating_accounts'
  | 'treasury_payments'
  | 'merchant_services'
  | 'working_capital'
  | 'equipment_vehicle'
  | 'commercial_real_estate'
  | 'sba_growth';

export interface ProductKnowledge {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  fitSignals: string[];
  discoveryQuestions: string[];
  sourceUrls: string[];
  sourceVerified: boolean;
  reviewNote: string;
  effectiveDate: string;
}

export interface ProductCatalog {
  version: string;
  publishedAt: string;
  bank: string;
  status: 'draft' | 'human_verified';
  sourceNote: string;
  products: ProductKnowledge[];
}

/**
 * Draft conversation categories—not official product names, eligibility rules,
 * pricing, approvals, or financial advice. A Flagstar employee must verify this
 * catalog against current internal/official material before customer use.
 */
export const FLAGSTAR_PRODUCT_CATALOG: ProductCatalog = {
  version: '2026-08-02.1-draft',
  publishedAt: '2026-08-02T00:00:00.000Z',
  bank: 'Flagstar Bank',
  status: 'draft',
  sourceNote:
    'Generic business-banking conversation categories. Flagstar public business pages were automation-blocked during research; all entries remain pending human verification.',
  products: [
    {
      id: 'operating-accounts',
      name: 'Business operating accounts discovery',
      category: 'operating_accounts',
      description: 'Explore operating checking, savings, account access, balances, transaction volume, and account-service needs.',
      fitSignals: ['Operating cash balances', 'Multiple locations or accounts', 'High transaction volume', 'Need for role-based account access'],
      discoveryQuestions: ['How are daily operating funds organized today?', 'Which account fees, limits, or access controls create friction?'],
      sourceUrls: ['https://www.flagstar.com/'],
      sourceVerified: false,
      reviewNote: 'Verify current Flagstar business account names, terms, fees, and eligibility before use.',
      effectiveDate: '2026-08-02',
    },
    {
      id: 'treasury-payments',
      name: 'Treasury and payments discovery',
      category: 'treasury_payments',
      description: 'Explore receivables, payables, ACH, wires, fraud controls, remote deposit, liquidity, and reporting needs.',
      fitSignals: ['Growing payroll', 'Many vendors or customer payments', 'Manual reconciliation', 'Fraud-control concerns', 'Multiple entities or locations'],
      discoveryQuestions: ['How are receivables and payables handled?', 'Where do reconciliation, approvals, or fraud controls slow the team down?'],
      sourceUrls: ['https://www.flagstar.com/'],
      sourceVerified: false,
      reviewNote: 'Verify available treasury services and qualification requirements with current Flagstar material.',
      effectiveDate: '2026-08-02',
    },
    {
      id: 'merchant-services',
      name: 'Merchant and payment acceptance discovery',
      category: 'merchant_services',
      description: 'Explore card, online, point-of-sale, invoicing, settlement, and payment-acceptance needs.',
      fitSignals: ['Retail or hospitality activity', 'Online sales', 'Customer card payments', 'Appointment or invoice payments'],
      discoveryQuestions: ['How do customers prefer to pay?', 'Are settlement timing, chargebacks, or reconciliation pain points?'],
      sourceUrls: ['https://www.flagstar.com/'],
      sourceVerified: false,
      reviewNote: 'Confirm whether and how Flagstar currently offers merchant services and any third-party relationships.',
      effectiveDate: '2026-08-02',
    },
    {
      id: 'working-capital',
      name: 'Working-capital and line-of-credit discovery',
      category: 'working_capital',
      description: 'Explore seasonal cash flow, inventory, receivables, contract timing, and short-term liquidity needs.',
      fitSignals: ['Seasonality', 'Inventory purchases', 'Slow receivables', 'Rapid growth', 'Contract mobilization costs'],
      discoveryQuestions: ['Where do timing gaps appear between expenses and collections?', 'What growth would be possible with more flexible liquidity?'],
      sourceUrls: ['https://www.flagstar.com/'],
      sourceVerified: false,
      reviewNote: 'Not an offer or credit decision. Verify current lending products, underwriting, and eligibility.',
      effectiveDate: '2026-08-02',
    },
    {
      id: 'equipment-vehicle',
      name: 'Equipment and vehicle finance discovery',
      category: 'equipment_vehicle',
      description: 'Explore planned purchases or replacement of equipment, vehicles, technology, and other productive assets.',
      fitSignals: ['Construction or manufacturing activity', 'Fleet operations', 'Capital equipment expansion', 'Aging equipment'],
      discoveryQuestions: ['What equipment or vehicles are planned in the next 12–24 months?', 'Would preserving operating cash matter for that purchase?'],
      sourceUrls: ['https://www.flagstar.com/'],
      sourceVerified: false,
      reviewNote: 'Verify current structures, collateral requirements, terms, and availability.',
      effectiveDate: '2026-08-02',
    },
    {
      id: 'commercial-real-estate',
      name: 'Owner-occupied commercial real-estate discovery',
      category: 'commercial_real_estate',
      description: 'Explore acquisition, renovation, refinance, expansion, or construction involving business-occupied property.',
      fitSignals: ['Property ownership', 'Lease expiration', 'Relocation or expansion', 'Renovation or construction plans'],
      discoveryQuestions: ['Does the business lease or own its primary location?', 'Are acquisition, expansion, or renovation plans under consideration?'],
      sourceUrls: ['https://www.flagstar.com/'],
      sourceVerified: false,
      reviewNote: 'Verify current commercial real-estate capabilities, geography, underwriting, and eligibility.',
      effectiveDate: '2026-08-02',
    },
    {
      id: 'sba-growth',
      name: 'SBA and business-growth finance discovery',
      category: 'sba_growth',
      description: 'Explore eligible acquisition, expansion, real estate, equipment, and working-capital goals that may warrant an SBA conversation.',
      fitSignals: ['Business acquisition', 'Expansion plan', 'Owner-occupied property', 'Equipment purchase', 'Need for longer amortization'],
      discoveryQuestions: ['What is the growth project and expected timeline?', 'Which uses of funds and owner contribution are anticipated?'],
      sourceUrls: ['https://www.flagstar.com/'],
      sourceVerified: false,
      reviewNote: 'SBA eligibility is fact-specific. Verify Flagstar program participation and current requirements.',
      effectiveDate: '2026-08-02',
    },
  ],
};
