-- Run in an isolated validation branch. All test objects are transaction-local.
BEGIN;
CREATE TEMP TABLE attachment_size_probe (size_bytes bigint);
DO $$
DECLARE definition text; n bigint;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO STRICT definition FROM pg_constraint
 WHERE conrelid='viaggio_app.day_attachments'::regclass
 AND conname='day_attachments_size_bytes_check';
 EXECUTE 'ALTER TABLE attachment_size_probe ADD CONSTRAINT size_check ' || definition;
 FOREACH n IN ARRAY ARRAY[1,6291456,6291457,20971520]::bigint[] LOOP
  INSERT INTO attachment_size_probe VALUES(n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY[-1,0,20971521]::bigint[] LOOP
  BEGIN
   INSERT INTO attachment_size_probe VALUES(n);
   RAISE EXCEPTION 'Unexpected acceptance: %',n;
  EXCEPTION WHEN check_violation THEN NULL;
  END;
 END LOOP;
END $$;
SELECT count(*) AS accepted_boundary_cases FROM attachment_size_probe;
ROLLBACK;
