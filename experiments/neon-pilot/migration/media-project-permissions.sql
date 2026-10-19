CREATE OR REPLACE FUNCTION viaggio_app.media_access(p_bucket text,p_path text,p_write boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := viaggio_identity.uid(); root text := split_part(p_path,'/',1); allowed boolean := false;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM viaggio_identity.users WHERE id=actor AND deleted_at IS NULL) OR EXISTS(SELECT 1 FROM viaggio_app.passenger_profiles WHERE user_id=actor AND is_deleted) THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_path IS NULL OR length(p_path)>1024 OR p_path ~ '(^|/)\.\.(/|$)' OR root !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'INVALID_PATH' USING ERRCODE='22023'; END IF;
 IF p_bucket IN ('trip-images','day-attachments') THEN
  allowed := viaggio_app.is_trip_member(root::uuid,CASE WHEN p_write THEN 'editor' ELSE 'viewer' END);
 ELSIF p_bucket='profile-photos' THEN
  allowed := root=actor::text AND (NOT p_write OR actor=viaggio_identity.project_owner());
  IF NOT p_write AND NOT allowed THEN
   allowed := EXISTS(SELECT 1 FROM viaggio_app.trips t WHERE t.user_id=root::uuid AND viaggio_app.is_trip_member(t.id))
     OR EXISTS(SELECT 1 FROM viaggio_app.passengers p WHERE p.user_id=root::uuid AND viaggio_app.is_trip_member(p.trip_id));
  END IF;
 END IF;
 IF NOT allowed THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('actor',actor,'authorized',true);
END $$;
