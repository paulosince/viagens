-- Synthetic-only tests. The nested subtransaction rolls back every fixture.
-- Any failed assertion aborts with its specific message; success returns normally.
DO $test$
DECLARE
 owner_id uuid := '10000000-0000-4000-8000-000000000001';
 viewer_id uuid := '10000000-0000-4000-8000-000000000002';
 stranger_id uuid := '10000000-0000-4000-8000-000000000003';
 trip_id uuid := '20000000-0000-4000-8000-000000000001';
 snap_id uuid := '30000000-0000-4000-8000-000000000001';
 n integer;
BEGIN
 BEGIN
  INSERT INTO viaggio_identity.users(id,email,email_confirmed_at) VALUES
   (owner_id,'owner@example.invalid',now()),(viewer_id,'viewer@example.invalid',now()),
   (stranger_id,'stranger@example.invalid',now());
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO viaggio_app.trips(id,user_id,name) VALUES(trip_id,owner_id,'Synthetic migration test');
  INSERT INTO viaggio_app.trip_members(trip_id,user_id,role) VALUES(trip_id,owner_id,'owner');
  IF (SELECT count(*) FROM viaggio_app.trips) <> 1 THEN RAISE EXCEPTION 'Owner cannot read own trip'; END IF;
  PERFORM viaggio_app.capture_trip_snapshot(snap_id,trip_id,'Synthetic checkpoint');
  IF (SELECT count(*) FROM viaggio_app.state_snapshots WHERE id=snap_id) <> 1 THEN RAISE EXCEPTION 'Snapshot not created'; END IF;
  PERFORM viaggio_app.ensure_trip_baseline_snapshot(trip_id);
  PERFORM viaggio_app.restore_trip_snapshot(snap_id);
  PERFORM viaggio_app.share_trip_with_email(trip_id,'viewer@example.invalid','viewer');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer_id,'role','authenticated')::text,true);
  IF (SELECT count(*) FROM viaggio_app.trips) <> 1 THEN RAISE EXCEPTION 'Viewer cannot read shared trip'; END IF;
  UPDATE viaggio_app.trips SET name='Forbidden viewer edit' WHERE id=trip_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Viewer edited shared trip'; END IF;
  BEGIN
   PERFORM viaggio_app.capture_trip_snapshot(gen_random_uuid(),trip_id,'Forbidden');
   RAISE EXCEPTION 'Viewer created snapshot' USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  PERFORM viaggio_app.invite_trip_by_email(trip_id,'viewer@example.invalid','editor');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer_id,'role','authenticated')::text,true);
  UPDATE viaggio_app.trips SET name='Allowed editor edit' WHERE id=trip_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Editor cannot edit shared trip'; END IF;
  BEGIN
   UPDATE viaggio_app.trips SET user_id=viewer_id WHERE id=trip_id;
   RAISE EXCEPTION 'Editor stole trip ownership' USING ERRCODE='Z0002';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  PERFORM viaggio_app.remove_trip_share(trip_id,'viewer@example.invalid');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer_id,'role','authenticated')::text,true);
  IF (SELECT count(*) FROM viaggio_app.trips) <> 0 THEN RAISE EXCEPTION 'Revoked member retains access'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',stranger_id,'role','authenticated')::text,true);
  IF (SELECT count(*) FROM viaggio_app.trips) <> 0 THEN RAISE EXCEPTION 'Unrelated account sees trip'; END IF;
  IF (SELECT count(*) FROM viaggio_app.state_snapshots) <> 0 THEN RAISE EXCEPTION 'Unrelated account sees snapshot'; END IF;
  IF has_function_privilege('authenticated','viaggio_app.expand_snapshot_photos(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Private photo helper exposed'; END IF;
  IF has_table_privilege('authenticated','viaggio_identity.users','SELECT') THEN RAISE EXCEPTION 'Identity directory exposed'; END IF;
  PERFORM set_config('request.jwt.claims','{}',true);
  IF (SELECT count(*) FROM viaggio_app.trips) <> 0 THEN RAISE EXCEPTION 'Missing identity sees trips'; END IF;
  SET LOCAL ROLE NONE;
  IF has_schema_privilege('anonymous','viaggio_app','USAGE') THEN RAISE EXCEPTION 'Anonymous schema access'; END IF;
  RAISE EXCEPTION 'ROLLBACK_SYNTHETIC_FIXTURES' USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
 END;
END;
$test$;
