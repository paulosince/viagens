DO $test$
DECLARE owner uuid; other uuid; n integer;
BEGIN
 SELECT owner_id INTO owner FROM viaggio_identity.project_binding;
 SELECT id INTO other FROM viaggio_identity.users WHERE id<>owner LIMIT 1;
 BEGIN
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO viaggio_app.trips(id,user_id,name) VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',owner,'isolation verification');
  SELECT count(*) INTO n FROM viaggio_app.trips WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  IF n<>1 THEN RAISE EXCEPTION 'owner cannot read created trip'; END IF;
  RESET ROLE;
  RAISE EXCEPTION 'ROLLBACK_FIXTURE' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 BEGIN
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO viaggio_app.trips(id,user_id,name) VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',other,'must fail');
  RAISE EXCEPTION 'wrong project accepted';
 EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 SELECT count(*) INTO n FROM viaggio_app.passenger_profiles;
 IF n<>0 THEN RAISE EXCEPTION 'foreign personal profile visible'; END IF;
 RESET ROLE;
END $test$;