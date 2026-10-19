CREATE OR REPLACE FUNCTION viaggio_app.project_context() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('is_home',coalesce(viaggio_identity.uid()=viaggio_identity.project_owner(),false)) $$;

REVOKE ALL ON FUNCTION viaggio_app.project_context() FROM PUBLIC,anonymous;

GRANT EXECUTE ON FUNCTION viaggio_app.project_context() TO authenticated;