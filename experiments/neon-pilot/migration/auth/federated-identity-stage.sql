-- Viaggio federated identity bridge / staging only.
-- This file is an idempotent, non-destructive representation of the implementation
-- installed on the two auth-federation-validation branches on 2026-10-20.
-- Do NOT apply to the main project branches before verified live-session cutover.
-- All link writes and activation are private administrative operations performed
-- only after independently validating old and new account control.
-- New signup, proof of address and account provisioning are separate features.
CREATE TABLE IF NOT EXISTS viaggio_identity.neon_auth_links (
  neon_subject uuid PRIMARY KEY,
  legacy_user_id uuid NOT NULL UNIQUE REFERENCES viaggio_identity.users(id) ON DELETE RESTRICT,
  proof_kind text NOT NULL DEFAULT 'dual_session' CHECK (proof_kind = 'dual_session'),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

-- Existing staging tables were created without activated_at; preserve all rows.
ALTER TABLE viaggio_identity.neon_auth_links ADD COLUMN IF NOT EXISTS activated_at timestamptz;

ALTER TABLE viaggio_identity.neon_auth_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE viaggio_identity.neon_auth_links FROM PUBLIC, anonymous, authenticated;

-- Identity resolution is the ONLY application-exposed operation on this private
-- association table. A prepared but not yet activated link must deny access.
-- Validation of the JWT signature / issuer is done by the project Data API.
CREATE OR REPLACE FUNCTION viaggio_identity.uid()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $link$
DECLARE claims jsonb; subject text; existing_user uuid;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NULL OR claims->>'role' IS DISTINCT FROM 'authenticated' THEN
    RETURN NULL;
  END IF;
  subject := claims->>'sub';
  IF subject IS NULL OR subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT l.legacy_user_id INTO existing_user
  FROM viaggio_identity.neon_auth_links AS l
  JOIN viaggio_identity.users u ON u.id = l.legacy_user_id
  WHERE l.neon_subject = subject::uuid
    AND l.proof_kind = 'dual_session'
    AND l.verified_at IS NOT NULL
    AND l.activated_at IS NOT NULL
    AND u.deleted_at IS NULL
    AND u.email_confirmed_at IS NOT NULL;
  RETURN existing_user;
END
$link$;

REVOKE ALL ON FUNCTION viaggio_identity.uid() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION viaggio_identity.uid() TO authenticated;
