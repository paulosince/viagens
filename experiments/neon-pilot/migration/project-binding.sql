CREATE TABLE viaggio_identity.project_binding (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), owner_id uuid NOT NULL UNIQUE REFERENCES viaggio_identity.users(id), project_id text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE viaggio_identity.project_binding ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON viaggio_identity.project_binding FROM PUBLIC, authenticated;

CREATE FUNCTION viaggio_identity.project_owner() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT owner_id FROM viaggio_identity.project_binding WHERE singleton $$;

REVOKE ALL ON FUNCTION viaggio_identity.project_owner() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION viaggio_identity.project_owner() TO authenticated;

CREATE FUNCTION viaggio_identity.guard_project_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF (to_jsonb(NEW)->>TG_ARGV[0])::uuid IS DISTINCT FROM viaggio_identity.project_owner() THEN RAISE EXCEPTION 'WRONG_OWNER_PROJECT' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;

REVOKE ALL ON FUNCTION viaggio_identity.guard_project_owner() FROM PUBLIC, authenticated;

CREATE TRIGGER bound_trip_owner BEFORE INSERT OR UPDATE OF user_id ON viaggio_app.trips FOR EACH ROW EXECUTE FUNCTION viaggio_identity.guard_project_owner('user_id');

CREATE TRIGGER bound_profile_owner BEFORE INSERT OR UPDATE ON viaggio_app.passenger_profiles FOR EACH ROW EXECUTE FUNCTION viaggio_identity.guard_project_owner('user_id');

CREATE TRIGGER bound_saved_owner BEFORE INSERT OR UPDATE ON viaggio_app.saved_passengers FOR EACH ROW EXECUTE FUNCTION viaggio_identity.guard_project_owner('owner_id');

CREATE POLICY project_personal_profile ON viaggio_app.passenger_profiles AS RESTRICTIVE FOR ALL TO authenticated USING (user_id=viaggio_identity.project_owner()) WITH CHECK (user_id=viaggio_identity.project_owner());

CREATE POLICY project_saved_passengers ON viaggio_app.saved_passengers AS RESTRICTIVE FOR ALL TO authenticated USING (owner_id=viaggio_identity.project_owner()) WITH CHECK (owner_id=viaggio_identity.project_owner());

-- Provision privately in the same transaction before enabling client access:
-- INSERT INTO viaggio_identity.project_binding(owner_id,project_id) VALUES (<owner uuid>,<project id>);
