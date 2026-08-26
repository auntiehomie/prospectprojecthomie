CREATE TABLE IF NOT EXISTS app_users (
  clerk_user_id text PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member','viewer')),
  active boolean NOT NULL DEFAULT true,
  invited_by text REFERENCES app_users(clerk_user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  code_prefix text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','viewer')),
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 25),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by text NOT NULL REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_invite_redemptions (
  invite_id uuid NOT NULL REFERENCES app_invites(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (invite_id, clerk_user_id)
);

CREATE INDEX IF NOT EXISTS app_invites_created_by_idx ON app_invites(created_by, created_at DESC);
