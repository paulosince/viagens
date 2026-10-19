"""Build the isolated Neon schema from an administrator-exported PG catalog.

Input contains schema definitions only. No source rows or credentials are committed.
The original database remains untouched. Execute output once in the staging branch.
"""
import json, pathlib, sys

catalog = json.loads(pathlib.Path(sys.argv[1]).read_text())
out = pathlib.Path(sys.argv[2])
def ident(value):
    return '"' + value.replace('"', '""') + '"'
def adapt(value):
    return (value.replace('public.', 'viaggio_app.')
            .replace('auth.users', 'viaggio_identity.users')
            .replace('auth.uid()', 'viaggio_identity.uid()')
            .replace("'public'", "'viaggio_app'")
            .replace("'auth'", "'viaggio_identity'"))

sql = ["""-- Isolated operational schema. Not exposed through Data API by this migration.
BEGIN;
CREATE SCHEMA viaggio_identity;
CREATE SCHEMA viaggio_app;
REVOKE ALL ON SCHEMA viaggio_identity, viaggio_app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA viaggio_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA viaggio_identity REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE viaggio_identity.users (
 id uuid PRIMARY KEY, email text NOT NULL, raw_user_meta_data jsonb NOT NULL DEFAULT '{}',
 email_confirmed_at timestamptz, deleted_at timestamptz
);
ALTER TABLE viaggio_identity.users ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION viaggio_identity.uid() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE claims jsonb; subject text;
BEGIN
 claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
 IF claims IS NULL OR claims->>'role' IS DISTINCT FROM 'authenticated' THEN RETURN NULL; END IF;
 subject := claims->>'sub';
 IF subject IS NULL OR subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN NULL; END IF;
 RETURN subject::uuid;
END $$;
GRANT USAGE ON SCHEMA viaggio_identity, viaggio_app TO authenticated;
GRANT EXECUTE ON FUNCTION viaggio_identity.uid() TO authenticated;
SET LOCAL search_path = viaggio_app, pg_catalog;
"""]
for t in catalog['tables']:
    cols=[]
    for c in t['columns']:
        cols.append(ident(c['name'])+' '+c['type']+(' DEFAULT '+adapt(c['default']) if c['default'] else '')+(' NOT NULL' if c['notnull'] else ''))
    sql.append('CREATE TABLE viaggio_app.'+ident(t['name'])+' (\n'+',\n'.join(cols)+'\n);')
    sql.append('ALTER TABLE viaggio_app.'+ident(t['name'])+' ENABLE ROW LEVEL SECURITY;')
for c in sorted(catalog['constraints'],key=lambda c:c['type']=='f'):
    sql.append('ALTER TABLE viaggio_app.'+ident(c['table'])+' ADD CONSTRAINT '+ident(c['name'])+' '+adapt(c['definition'])+';')
# SQL functions resolve references at creation; PL/pgSQL resolves bodies at execution.
sql.append('SET LOCAL check_function_bodies = off;')
for f in catalog['functions']:
    if f['name'] in ['has_chatgpt_connection','viaggio_my_usage','purge_expired_trip_days']:
        continue  # These depend on Supabase infrastructure, not portable tables.
    definition = adapt(f['definition'])
    if f['name'] == 'share_trip_with_email':
        definition = definition.replace(
            'select 1 from viaggio_app.trip_members\n    where trip_id = p_trip_id and user_id = viaggio_identity.uid() and role = \'owner\'',
            'select 1 from viaggio_app.trip_members m\n    where m.trip_id = p_trip_id and m.user_id = viaggio_identity.uid() and m.role = \'owner\'')
        definition = definition.replace('on conflict (trip_id,user_id) do update',
                                        'on conflict on constraint trip_members_pkey do update')
    sql.append(definition+';')
for trigger in catalog['triggers']:
    sql.append(adapt(trigger)+';')
for p in catalog['policies']:
    stmt='CREATE POLICY '+ident(p['policyname'])+' ON viaggio_app.'+ident(p['tablename'])+' AS '+p['permissive']+' FOR '+p['cmd']+' TO authenticated'
    if p['qual']: stmt+=' USING ('+adapt(p['qual'])+')'
    if p['with_check']: stmt+=' WITH CHECK ('+adapt(p['with_check'])+')'
    sql.append(stmt+';')
sql.append('REVOKE ALL ON ALL TABLES IN SCHEMA viaggio_app, viaggio_identity FROM PUBLIC, anonymous;')
sql.append('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA viaggio_app, viaggio_identity FROM PUBLIC, anonymous;')
for t in catalog['tables']:
    if t['name'] not in ['snapshot_photos','trip_invitations']:
        sql.append('GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app.'+ident(t['name'])+' TO authenticated;')
allowed=['is_trip_member','soft_delete_own_account','ensure_trip_baseline_snapshot','restore_trip_snapshot','capture_trip_snapshot','claim_trip_invitations','share_trip_with_email','list_trip_members','invite_trip_by_email','list_trip_shares','remove_trip_share','shared_trip_owners']
# Grant only app entrypoints. Internal snapshot helpers retain no client EXECUTE.
sql.append("DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='viaggio_app' AND p.proname = ANY (ARRAY["+','.join("'"+x+"'" for x in allowed)+"]) LOOP EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.signature||' TO authenticated'; END LOOP; END $$;")
sql.append("""CREATE FUNCTION viaggio_identity.guard_trip_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
  RAISE EXCEPTION 'Trip identity and ownership are immutable' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_trip_identity BEFORE UPDATE ON viaggio_app.trips
FOR EACH ROW EXECUTE FUNCTION viaggio_identity.guard_trip_identity();
COMMIT;
""")
out.write_text('\n'.join(line.rstrip() for line in '\n\n'.join(sql).splitlines())+'\n')
print('Generated', len(catalog['tables']), 'tables and', len(catalog['policies']), 'RLS policies')
