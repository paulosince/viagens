-- Read-only project usage. The gateway obtains physical files from S3 ListObjectsV2.
-- No caller-provided identity/project; shared-trip access does not grant usage access.
CREATE OR REPLACE FUNCTION viaggio_app.viaggio_my_usage()
RETURNS TABLE(database_bytes bigint, database_quota_bytes bigint, storage_quota_bytes bigint,
              image_bytes bigint, attachment_bytes bigint, owned_trips bigint, measured_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid := viaggio_identity.uid();
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM viaggio_identity.project_owner()
    OR EXISTS(SELECT 1 FROM viaggio_app.passenger_profiles WHERE user_id=actor AND is_deleted)
 THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT
   (SELECT sum(pg_catalog.pg_database_size(d.oid))::bigint FROM pg_catalog.pg_database d),
   pg_catalog.pg_size_bytes(pg_catalog.current_setting('neon.max_cluster_size')),
   (SELECT allowance_bytes FROM viaggio_lab.v2_storage_budget WHERE singleton=1),
   (SELECT coalesce(sum(bytes),0)::bigint FROM viaggio_identity.media
     WHERE status='ready' AND deleted_at IS NULL AND bucket_id IN ('trip-images','profile-photos')),
   (SELECT coalesce(sum(bytes),0)::bigint FROM viaggio_identity.media
     WHERE status='ready' AND deleted_at IS NULL AND bucket_id='day-attachments'),
   (SELECT count(*) FROM viaggio_app.trips WHERE user_id=actor),
   pg_catalog.statement_timestamp();
END $$;
REVOKE ALL ON FUNCTION viaggio_app.viaggio_my_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION viaggio_app.viaggio_my_usage() TO authenticated;
