-- Staging-only: apply on the auth-federation-validation branches in each user's project.
-- Do not run on the main branch before a verified identity-claim flow and cutover.
-- Never insert identity links based only on an unverified email or user-supplied UUID.
CREATE TABLE IF NOT EXISTS viaggio_identity.neon_auth_links (
  neon_subject uuid PRIMARY KEY,
  legacy_user_id uuid NOT NULL UNIQUE REFERENCES viaggio_identity.users(id) ON DELETE RESTRICT,
  proof_kind text NOT NULL DEFAULT 'dual_session' CHECK (proof_kind = 'dual_session'),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE viaggio_identity.neon_auth_links FROM PUBLIC, authenticated, anonymous;
ALTER TABLE viaggio_identity.neon_auth_links ENABLE ROW LEVEL SECURITY;

-- This private resolver is read by application RLS. The JWT has to be validated
-- by the Data API against the one configured central JWKS before these claims are set.
-- Existing unlinked accounts deliberately resolve to NULL.
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
  IF subject IS NULL OR subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT l.legacy_user_id INTO existing_user
  FROM viaggio_identity.neon_auth_links AS l
  WHERE l.neon_subject = subject::uuid
    AND l.proof_kind = 'dual_session'
    AND l.verified_at IS NOT NULL;
  RETURN existing_user;
END
$link$;
-- Keep the original private function grant. This is defense in depth:
REVOKE ALL ON FUNCTION viaggio_identity.uid() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION viaggio_identity.uid() TO authenticated;
