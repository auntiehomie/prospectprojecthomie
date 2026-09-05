CREATE TABLE IF NOT EXISTS business_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by text NOT NULL REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  display_name text NOT NULL,
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL,
  state char(2) NOT NULL DEFAULT 'MI',
  zip_code text NOT NULL DEFAULT '',
  website_url text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ucc_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES business_investigations(id) ON DELETE CASCADE,
  filing_number text NOT NULL,
  filing_status text NOT NULL DEFAULT 'unknown' CHECK (filing_status IN ('active','lapsed','terminated','unknown')),
  filing_date date,
  secured_party text NOT NULL,
  collateral_summary text NOT NULL DEFAULT '',
  source_url text NOT NULL,
  observed_at date NOT NULL,
  reviewer_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, filing_number, secured_party)
);

CREATE INDEX IF NOT EXISTS investigations_created_by_idx
  ON business_investigations(created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS ucc_filings_investigation_idx
  ON ucc_filings(investigation_id, filing_date DESC);
