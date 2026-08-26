CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('active','inactive','unverified')),
  naics_code text,
  lara_entity_id text,
  source_url text NOT NULL,
  observed_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legal_name, lara_entity_id)
);

CREATE TABLE IF NOT EXISTS business_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  address_line text NOT NULL,
  city text NOT NULL,
  state char(2) NOT NULL DEFAULT 'MI',
  zip_code char(5) NOT NULL,
  latitude double precision,
  longitude double precision,
  geocode_source_url text,
  geocoded_at timestamptz,
  UNIQUE (business_id, address_line, zip_code)
);

CREATE TABLE IF NOT EXISTS bank_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fdic_uninum text UNIQUE,
  institution_name text NOT NULL,
  fdic_cert text,
  branch_name text,
  address_line text NOT NULL,
  city text NOT NULL,
  state char(2) NOT NULL,
  zip_code char(5) NOT NULL,
  latitude double precision,
  longitude double precision,
  source_url text NOT NULL,
  observed_at date NOT NULL
);

CREATE TABLE IF NOT EXISTS branch_closure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES bank_branches(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('filed','approved','withdrawn','completed','unverified')),
  filed_at date,
  effective_at date,
  regulator text NOT NULL,
  filing_id text,
  source_url text NOT NULL,
  observed_at date NOT NULL,
  UNIQUE (branch_id, source_url)
);

CREATE TABLE IF NOT EXISTS relationship_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN ('ppp_lender','sba_lender','ucc_secured_party','mortgage_lender','public_announcement','human_confirmed')),
  relationship_date date,
  status text NOT NULL DEFAULT 'historical' CHECK (status IN ('historical','current','unknown','ended')),
  confidence text NOT NULL CHECK (confidence IN ('confirmed','likely','possible','unverified')),
  source_url text NOT NULL,
  observed_at date NOT NULL,
  match_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  claim text NOT NULL,
  observed_at date NOT NULL,
  expires_at date,
  confidence text NOT NULL CHECK (confidence IN ('confirmed','likely','possible','unverified')),
  source_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS needs_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  need_type text NOT NULL,
  rationale text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','human_confirmed','rejected','stale')),
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hypothesis_evidence (
  hypothesis_id uuid NOT NULL REFERENCES needs_hypotheses(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES business_signals(id) ON DELETE CASCADE,
  PRIMARY KEY (hypothesis_id, signal_id)
);

CREATE TABLE IF NOT EXISTS suppression_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  normalized_contact text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, normalized_contact)
);

CREATE TABLE IF NOT EXISTS stored_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  address text NOT NULL DEFAULT '',
  contact_type text NOT NULL CHECK (contact_type IN ('phone','email','linkedin','website','other')),
  value text NOT NULL,
  source text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stored_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  address text NOT NULL DEFAULT '',
  label text NOT NULL,
  source text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('confirmed','likely','possible','unverified')),
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stored_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  address text NOT NULL DEFAULT '',
  recommendation_id text NOT NULL,
  agreement text NOT NULL CHECK (agreement IN ('agree','disagree','partial','skip')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stored_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  address text NOT NULL DEFAULT '',
  outcome text NOT NULL CHECK (outcome IN ('pending','contacted','responded','qualified','not_interested','opted_out')),
  notes text NOT NULL DEFAULT '',
  contact_method text,
  contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_locations_zip_idx ON business_locations(zip_code);
CREATE INDEX IF NOT EXISTS branch_closure_status_idx ON branch_closure_events(status, effective_at);
CREATE INDEX IF NOT EXISTS relationship_business_idx ON relationship_evidence(business_id, institution_name);
CREATE INDEX IF NOT EXISTS signals_business_idx ON business_signals(business_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS stored_contacts_business_idx ON stored_contacts(business_name);
