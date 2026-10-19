-- Isolated operational schema. Not exposed through Data API by this migration.
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


CREATE TABLE viaggio_app."trips" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid DEFAULT viaggio_identity.uid() NOT NULL,
"name" text NOT NULL,
"detail" text DEFAULT ''::text NOT NULL,
"status" text DEFAULT 'Ainda sem roteiro'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"destination" text DEFAULT ''::text NOT NULL,
"start_date" date,
"arrival_method" text,
"location_label" text,
"latitude" numeric,
"longitude" numeric,
"cover_url" text,
"theme_id" text DEFAULT 'classic'::text NOT NULL,
"primary_color" text DEFAULT '#14212b'::text NOT NULL,
"secondary_color" text DEFAULT '#b89d63'::text NOT NULL,
"deleted_at" timestamp with time zone,
"day_count" integer DEFAULT 1 NOT NULL,
"cover_path" text,
"cover_hash" text,
"cover_updated_at" timestamp with time zone
);

ALTER TABLE viaggio_app."trips" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."checklist_items" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"trip_id" uuid NOT NULL,
"activity_id" uuid,
"label" text NOT NULL,
"due_at" timestamp with time zone,
"completed" boolean DEFAULT false NOT NULL
);

ALTER TABLE viaggio_app."checklist_items" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."budget_items" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"trip_id" uuid NOT NULL,
"activity_id" uuid,
"label" text NOT NULL,
"category" text,
"currency" text DEFAULT 'BRL'::text NOT NULL,
"planned_amount" numeric(12,2),
"actual_amount" numeric(12,2),
"exchange_rate" numeric(14,6),
"exchange_rate_date" date,
"purchase_status" text DEFAULT 'pending'::text NOT NULL
);

ALTER TABLE viaggio_app."budget_items" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."trip_members" (
"trip_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"role" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE viaggio_app."trip_members" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."passengers" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"trip_id" uuid NOT NULL,
"name" text NOT NULL,
"age" integer,
"gender" text,
"photo_url" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"user_id" uuid,
"birth_date" date,
"photo_path" text,
"photo_hash" text,
"photo_updated_at" timestamp with time zone
);

ALTER TABLE viaggio_app."passengers" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."trip_days" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"trip_id" uuid NOT NULL,
"title" text,
"summary" text,
"photo_url" text,
"status" text DEFAULT 'empty'::text NOT NULL,
"position" integer DEFAULT 0 NOT NULL,
"is_hidden" boolean DEFAULT false NOT NULL,
"deleted_at" timestamp with time zone,
"photo_path" text,
"photo_hash" text,
"photo_updated_at" timestamp with time zone
);

ALTER TABLE viaggio_app."trip_days" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."snapshot_photos" (
"trip_id" uuid NOT NULL,
"photo_hash" text NOT NULL,
"photo_data" text NOT NULL
);

ALTER TABLE viaggio_app."snapshot_photos" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."activities" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"day_id" uuid NOT NULL,
"period" text NOT NULL,
"position" integer DEFAULT 0 NOT NULL,
"title" text NOT NULL,
"description" text,
"place_name" text,
"address" text,
"latitude" numeric,
"longitude" numeric,
"place_id" text,
"photo_url" text,
"ticket_required" boolean DEFAULT false NOT NULL,
"purchase_status" text DEFAULT 'not_needed'::text NOT NULL,
"currency" text DEFAULT 'BRL'::text NOT NULL,
"planned_amount" numeric(12,2),
"actual_amount" numeric(12,2),
"exchange_rate" numeric(14,6),
"exchange_rate_date" date,
"shopping_items" text,
"meal" text,
"transport" text,
"notes" text,
"start_time" time without time zone,
"photo_path" text,
"photo_hash" text,
"photo_updated_at" timestamp with time zone
);

ALTER TABLE viaggio_app."activities" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."passenger_profiles" (
"user_id" uuid NOT NULL,
"name" text NOT NULL,
"birth_date" date,
"avatar_path" text,
"is_deleted" boolean DEFAULT false NOT NULL,
"deleted_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE viaggio_app."passenger_profiles" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."day_locations" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"day_id" uuid NOT NULL,
"position" integer DEFAULT 0 NOT NULL,
"name" text NOT NULL,
"photo_url" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"provider" text,
"provider_place_id" text,
"formatted_address" text,
"latitude" double precision,
"longitude" double precision,
"category" text,
"place_type" text,
"photo_provider" text,
"photo_author" text,
"photo_author_url" text,
"photo_source_url" text,
"photo_path" text,
"photo_hash" text,
"photo_updated_at" timestamp with time zone
);

ALTER TABLE viaggio_app."day_locations" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."saved_passengers" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"owner_id" uuid NOT NULL,
"name" text NOT NULL,
"birth_date" date,
"photo_url" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"photo_path" text,
"photo_hash" text,
"photo_updated_at" timestamp with time zone
);

ALTER TABLE viaggio_app."saved_passengers" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."day_attachments" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"day_id" uuid,
"storage_path" text NOT NULL,
"file_name" text NOT NULL,
"mime_type" text NOT NULL,
"size_bytes" integer NOT NULL,
"created_by" uuid DEFAULT viaggio_identity.uid() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"trip_id" uuid NOT NULL
);

ALTER TABLE viaggio_app."day_attachments" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."change_log" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"trip_id" uuid,
"entity_type" text NOT NULL,
"entity_id" text,
"action" text NOT NULL,
"summary" text NOT NULL,
"before_state" jsonb,
"after_state" jsonb,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"snapshot_id" uuid,
"source" text DEFAULT 'viaggio'::text NOT NULL,
"client_id" text
);

ALTER TABLE viaggio_app."change_log" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."trip_invitations" (
"trip_id" uuid NOT NULL,
"email" text NOT NULL,
"role" text NOT NULL,
"invited_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE viaggio_app."trip_invitations" ENABLE ROW LEVEL SECURITY;

CREATE TABLE viaggio_app."state_snapshots" (
"id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"trip_id" uuid NOT NULL,
"label" text,
"state" jsonb NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE viaggio_app."state_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE viaggio_app."trips" ADD CONSTRAINT "trips_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."passengers" ADD CONSTRAINT "passengers_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."trip_days" ADD CONSTRAINT "trip_days_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."activities" ADD CONSTRAINT "activities_period_check" CHECK ((period = ANY (ARRAY['morning'::text, 'afternoon'::text, 'night'::text])));

ALTER TABLE viaggio_app."activities" ADD CONSTRAINT "activities_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."checklist_items" ADD CONSTRAINT "checklist_items_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."budget_items" ADD CONSTRAINT "budget_items_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."trip_members" ADD CONSTRAINT "trip_members_role_check" CHECK ((role = ANY (ARRAY['viewer'::text, 'editor'::text, 'owner'::text])));

ALTER TABLE viaggio_app."trip_members" ADD CONSTRAINT "trip_members_pkey" PRIMARY KEY (trip_id, user_id);

ALTER TABLE viaggio_app."passenger_profiles" ADD CONSTRAINT "passenger_profiles_pkey" PRIMARY KEY (user_id);

ALTER TABLE viaggio_app."day_locations" ADD CONSTRAINT "day_locations_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."trips" ADD CONSTRAINT "trips_day_count_positive" CHECK (((day_count >= 1) AND (day_count <= 365)));

ALTER TABLE viaggio_app."change_log" ADD CONSTRAINT "change_log_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."state_snapshots" ADD CONSTRAINT "state_snapshots_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."day_attachments" ADD CONSTRAINT "day_attachments_size_bytes_check" CHECK (((size_bytes > 0) AND (size_bytes <= 6291456)));

ALTER TABLE viaggio_app."day_attachments" ADD CONSTRAINT "day_attachments_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."day_attachments" ADD CONSTRAINT "day_attachments_storage_path_key" UNIQUE (storage_path);

ALTER TABLE viaggio_app."saved_passengers" ADD CONSTRAINT "saved_passengers_name_check" CHECK ((length(TRIM(BOTH FROM name)) > 0));

ALTER TABLE viaggio_app."saved_passengers" ADD CONSTRAINT "saved_passengers_pkey" PRIMARY KEY (id);

ALTER TABLE viaggio_app."trip_invitations" ADD CONSTRAINT "trip_invitations_role_check" CHECK ((role = ANY (ARRAY['viewer'::text, 'editor'::text])));

ALTER TABLE viaggio_app."trip_invitations" ADD CONSTRAINT "trip_invitations_email_check" CHECK ((email = lower(btrim(email))));

ALTER TABLE viaggio_app."trip_invitations" ADD CONSTRAINT "trip_invitations_pkey" PRIMARY KEY (trip_id, email);

ALTER TABLE viaggio_app."snapshot_photos" ADD CONSTRAINT "snapshot_photos_pkey" PRIMARY KEY (trip_id, photo_hash);

ALTER TABLE viaggio_app."trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY (user_id) REFERENCES viaggio_identity.users(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."passengers" ADD CONSTRAINT "passengers_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."trip_days" ADD CONSTRAINT "trip_days_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."activities" ADD CONSTRAINT "activities_day_id_fkey" FOREIGN KEY (day_id) REFERENCES trip_days(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."checklist_items" ADD CONSTRAINT "checklist_items_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."checklist_items" ADD CONSTRAINT "checklist_items_activity_id_fkey" FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL;

ALTER TABLE viaggio_app."budget_items" ADD CONSTRAINT "budget_items_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."budget_items" ADD CONSTRAINT "budget_items_activity_id_fkey" FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL;

ALTER TABLE viaggio_app."trip_members" ADD CONSTRAINT "trip_members_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."trip_members" ADD CONSTRAINT "trip_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES viaggio_identity.users(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."passenger_profiles" ADD CONSTRAINT "passenger_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES viaggio_identity.users(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."passengers" ADD CONSTRAINT "passengers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES viaggio_identity.users(id) ON DELETE SET NULL;

ALTER TABLE viaggio_app."day_locations" ADD CONSTRAINT "day_locations_day_id_fkey" FOREIGN KEY (day_id) REFERENCES trip_days(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."change_log" ADD CONSTRAINT "change_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES viaggio_identity.users(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."change_log" ADD CONSTRAINT "change_log_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;

ALTER TABLE viaggio_app."state_snapshots" ADD CONSTRAINT "state_snapshots_user_id_fkey" FOREIGN KEY (user_id) REFERENCES viaggio_identity.users(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."state_snapshots" ADD CONSTRAINT "state_snapshots_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."change_log" ADD CONSTRAINT "change_log_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES state_snapshots(id) ON DELETE SET NULL;

ALTER TABLE viaggio_app."day_attachments" ADD CONSTRAINT "day_attachments_day_id_fkey" FOREIGN KEY (day_id) REFERENCES trip_days(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."day_attachments" ADD CONSTRAINT "day_attachments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES viaggio_identity.users(id);

ALTER TABLE viaggio_app."saved_passengers" ADD CONSTRAINT "saved_passengers_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES viaggio_identity.users(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."trip_invitations" ADD CONSTRAINT "trip_invitations_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."trip_invitations" ADD CONSTRAINT "trip_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES viaggio_identity.users(id);

ALTER TABLE viaggio_app."snapshot_photos" ADD CONSTRAINT "snapshot_photos_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE viaggio_app."day_attachments" ADD CONSTRAINT "day_attachments_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

SET LOCAL check_function_bodies = off;

CREATE OR REPLACE FUNCTION viaggio_app.ensure_day_location_created_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'viaggio_app'
AS $function$
begin
  new.created_at := coalesce(
    new.created_at,
    case when tg_op = 'UPDATE' then old.created_at else null end,
    now()
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.is_trip_member(target_trip uuid, minimum_role text DEFAULT 'viewer'::text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app'
AS $function$
  select exists (
    select 1 from viaggio_app.trip_members m
    where m.trip_id = target_trip and m.user_id = viaggio_identity.uid()
      and case minimum_role when 'viewer' then m.role in ('viewer','editor','owner')
           when 'editor' then m.role in ('editor','owner')
           when 'owner' then m.role = 'owner' end
  );
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.soft_delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app', 'viaggio_identity'
AS $function$
declare
  current_user_id uuid := viaggio_identity.uid();
begin
  if current_user_id is null then raise exception 'Sessão inválida'; end if;
  insert into viaggio_app.passenger_profiles (user_id, name, is_deleted, deleted_at)
  select id, coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)), true, now()
  from viaggio_identity.users where id = current_user_id
  on conflict (user_id) do update set is_deleted = true, deleted_at = now(), updated_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.ensure_trip_baseline_snapshot(p_trip_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app'
AS $function$
declare
  uid uuid := viaggio_identity.uid();
  snapshot_id uuid;
  log_id uuid := gen_random_uuid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not viaggio_app.is_trip_member(p_trip_id, 'editor') then
    raise exception 'Not authorized for this trip';
  end if;

  select id
  into snapshot_id
  from viaggio_app.state_snapshots
  where user_id = uid
    and trip_id = p_trip_id
  order by created_at asc
  limit 1;

  if snapshot_id is not null then
    return snapshot_id;
  end if;

  snapshot_id := gen_random_uuid();
  perform viaggio_app.capture_trip_snapshot(
    snapshot_id,
    p_trip_id,
    'Ponto de segurança inicial'
  );

  insert into viaggio_app.change_log (
    id, user_id, trip_id, entity_type, entity_id, action, summary,
    before_state, after_state, snapshot_id
  )
  values (
    log_id,
    uid,
    p_trip_id,
    'trip',
    p_trip_id::text,
    'checkpoint',
    'Ponto de segurança inicial',
    null,
    null,
    snapshot_id
  );

  return snapshot_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.restore_trip_snapshot(p_snapshot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app'
AS $function$
declare
  uid uuid := viaggio_identity.uid();
  snap viaggio_app.state_snapshots%rowtype;
  safety_id uuid := gen_random_uuid();
  restored_id uuid := gen_random_uuid();
  log_id uuid := gen_random_uuid();
  trip_json jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into snap
  from viaggio_app.state_snapshots
  where id = p_snapshot_id
    and user_id = uid;

  if not found then
    raise exception 'Snapshot not found';
  end if;

  if not viaggio_app.is_trip_member(snap.trip_id, 'owner') then
    raise exception 'Only a trip owner can restore a snapshot';
  end if;

  snap.state := viaggio_app.expand_snapshot_photos(snap.trip_id, snap.state);

  perform viaggio_app.capture_trip_snapshot(
    safety_id,
    snap.trip_id,
    'Antes de restaurar ' || left(p_snapshot_id::text, 8)
  );

  trip_json := snap.state->'trip';

  delete from viaggio_app.checklist_items where trip_id = snap.trip_id;
  delete from viaggio_app.budget_items where trip_id = snap.trip_id;
  delete from viaggio_app.day_locations
    where day_id in (select id from viaggio_app.trip_days where trip_id = snap.trip_id);
  delete from viaggio_app.activities
    where day_id in (select id from viaggio_app.trip_days where trip_id = snap.trip_id);
  delete from viaggio_app.trip_days where trip_id = snap.trip_id;
  delete from viaggio_app.passengers where trip_id = snap.trip_id;

  update viaggio_app.trips
  set
    name = coalesce(trip_json->>'name', name),
    detail = coalesce(trip_json->>'detail', ''),
    status = coalesce(trip_json->>'status', status),
    destination = coalesce(trip_json->>'destination', ''),
    start_date = nullif(trip_json->>'start_date', '')::date,
    arrival_method = nullif(trip_json->>'arrival_method', ''),
    location_label = nullif(trip_json->>'location_label', ''),
    latitude = nullif(trip_json->>'latitude', '')::numeric,
    longitude = nullif(trip_json->>'longitude', '')::numeric,
    cover_url = nullif(trip_json->>'cover_url', ''),
    cover_path = nullif(trip_json->>'cover_path', ''),
    cover_hash = nullif(trip_json->>'cover_hash', ''),
    cover_updated_at = nullif(trip_json->>'cover_updated_at', '')::timestamptz,
    theme_id = coalesce(trip_json->>'theme_id', theme_id),
    primary_color = coalesce(trip_json->>'primary_color', primary_color),
    secondary_color = coalesce(trip_json->>'secondary_color', secondary_color),
    deleted_at = nullif(trip_json->>'deleted_at', '')::timestamptz,
    day_count = coalesce(nullif(trip_json->>'day_count', '')::integer, day_count)
  where id = snap.trip_id;

  insert into viaggio_app.passengers (
    id, trip_id, name, age, gender, photo_url, created_at, user_id, birth_date,
    photo_path, photo_hash, photo_updated_at
  )
  select id, trip_id, name, age, gender, photo_url, created_at, user_id, birth_date,
         photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::viaggio_app.passengers, snap.state->'passengers');

  insert into viaggio_app.trip_days (
    id, trip_id, title, summary, photo_url, status, position, is_hidden, deleted_at,
    photo_path, photo_hash, photo_updated_at
  )
  select id, trip_id, title, summary, photo_url, status, position, is_hidden, deleted_at,
         photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::viaggio_app.trip_days, snap.state->'days');

  insert into viaggio_app.day_locations (
    id, day_id, position, name, photo_url, created_at, provider, provider_place_id,
    formatted_address, latitude, longitude, category, place_type, photo_provider,
    photo_author, photo_author_url, photo_source_url,
    photo_path, photo_hash, photo_updated_at
  )
  select id, day_id, position, name, photo_url, created_at, provider, provider_place_id,
         formatted_address, latitude, longitude, category, place_type, photo_provider,
         photo_author, photo_author_url, photo_source_url,
         photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::viaggio_app.day_locations, snap.state->'locations');

  insert into viaggio_app.activities (
    id, day_id, period, position, title, description, place_name, address, latitude,
    longitude, place_id, photo_url, ticket_required, purchase_status, currency,
    planned_amount, actual_amount, exchange_rate, exchange_rate_date, shopping_items,
    meal, transport, notes, start_time,
    photo_path, photo_hash, photo_updated_at
  )
  select id, day_id, period, position, title, description, place_name, address, latitude,
         longitude, place_id, photo_url, ticket_required, purchase_status, currency,
         planned_amount, actual_amount, exchange_rate, exchange_rate_date, shopping_items,
         meal, transport, notes, start_time,
         photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::viaggio_app.activities, snap.state->'activities');

  insert into viaggio_app.checklist_items (
    id, trip_id, activity_id, label, due_at, completed
  )
  select id, trip_id, activity_id, label, due_at, completed
  from jsonb_populate_recordset(null::viaggio_app.checklist_items, snap.state->'checklist_items');

  insert into viaggio_app.budget_items (
    id, trip_id, activity_id, label, category, currency, planned_amount, actual_amount,
    exchange_rate, exchange_rate_date, purchase_status
  )
  select id, trip_id, activity_id, label, category, currency, planned_amount, actual_amount,
         exchange_rate, exchange_rate_date, purchase_status
  from jsonb_populate_recordset(null::viaggio_app.budget_items, snap.state->'budget_items');

  perform viaggio_app.capture_trip_snapshot(
    restored_id,
    snap.trip_id,
    'Restaurado de ' || left(p_snapshot_id::text, 8)
  );

  insert into viaggio_app.change_log (
    id, user_id, trip_id, entity_type, entity_id, action, summary,
    before_state, after_state, snapshot_id
  )
  values (
    log_id,
    uid,
    snap.trip_id,
    'trip',
    snap.trip_id::text,
    'restore',
    'Viagem restaurada para o snapshot ' || left(p_snapshot_id::text, 8),
    jsonb_build_object('safety_snapshot_id', safety_id),
    jsonb_build_object('restored_from_snapshot_id', p_snapshot_id),
    restored_id
  );

  return jsonb_build_object(
    'trip_id', snap.trip_id,
    'restored_from_snapshot_id', p_snapshot_id,
    'restored_snapshot_id', restored_id,
    'safety_snapshot_id', safety_id,
    'change_log_id', log_id
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.capture_trip_snapshot(p_snapshot_id uuid, p_trip_id uuid, p_label text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app'
 SET statement_timeout TO '30s'
AS $function$
declare
  uid uuid := viaggio_identity.uid();
  payload jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not viaggio_app.is_trip_member(p_trip_id, 'editor') then
    raise exception 'Not authorized for this trip';
  end if;

  select jsonb_build_object(
    'trip',
      (to_jsonb(t) - 'cover_url')
      || jsonb_build_object('cover_url', viaggio_app.snapshot_photo_value(p_trip_id, t.cover_url)),
    'passengers', coalesce((
      select jsonb_agg(
        (to_jsonb(p) - 'photo_url')
        || jsonb_build_object('photo_url', viaggio_app.snapshot_photo_value(p_trip_id, p.photo_url))
        order by p.created_at, p.id
      )
      from viaggio_app.passengers p
      where p.trip_id = p_trip_id
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(
        (to_jsonb(d) - 'photo_url')
        || jsonb_build_object('photo_url', viaggio_app.snapshot_photo_value(p_trip_id, d.photo_url))
        order by d.position, d.id
      )
      from viaggio_app.trip_days d
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(
        (to_jsonb(l) - 'photo_url')
        || jsonb_build_object('photo_url', viaggio_app.snapshot_photo_value(p_trip_id, l.photo_url))
        order by d.position, l.position, l.id
      )
      from viaggio_app.day_locations l
      join viaggio_app.trip_days d on d.id = l.day_id
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(
        (to_jsonb(a) - 'photo_url')
        || jsonb_build_object('photo_url', viaggio_app.snapshot_photo_value(p_trip_id, a.photo_url))
        order by d.position, a.position, a.id
      )
      from viaggio_app.activities a
      join viaggio_app.trip_days d on d.id = a.day_id
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'checklist_items', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.id)
      from viaggio_app.checklist_items c
      where c.trip_id = p_trip_id
    ), '[]'::jsonb),
    'budget_items', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.id)
      from viaggio_app.budget_items b
      where b.trip_id = p_trip_id
    ), '[]'::jsonb)
  )
  into payload
  from viaggio_app.trips t
  where t.id = p_trip_id;

  if payload is null then
    raise exception 'Trip not found';
  end if;

  insert into viaggio_app.state_snapshots (id, user_id, trip_id, label, state)
  values (p_snapshot_id, uid, p_trip_id, p_label, payload)
  on conflict (id) do nothing;

  return p_snapshot_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.claim_trip_invitations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  user_email text;
  claimed integer := 0;
begin
  if viaggio_identity.uid() is null then raise exception 'Sessão inválida'; end if;
  select lower(u.email) into user_email from viaggio_identity.users u
    where u.id = viaggio_identity.uid() and u.email_confirmed_at is not null and u.deleted_at is null;
  if user_email is null then return 0; end if;
  insert into viaggio_app.trip_members(trip_id,user_id,role)
  select i.trip_id,viaggio_identity.uid(),i.role from viaggio_app.trip_invitations i
    join viaggio_app.trips t on t.id = i.trip_id and t.user_id = i.invited_by
    where i.email = user_email
  on conflict (trip_id,user_id) do nothing;
  get diagnostics claimed = row_count;
  delete from viaggio_app.trip_invitations where email = user_email;
  return claimed;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.share_trip_with_email(p_trip_id uuid, p_email text, p_role text DEFAULT 'editor'::text)
 RETURNS TABLE(user_id uuid, email text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app', 'viaggio_identity'
AS $function$
declare
  target_user viaggio_identity.users%rowtype;
  normalized_role text := lower(coalesce(p_role, 'editor'));
begin
  if viaggio_identity.uid() is null then raise exception 'Sessão inválida'; end if;
  if normalized_role not in ('viewer','editor') then raise exception 'Permissão inválida'; end if;
  if not exists (
    select 1 from viaggio_app.trip_members m
    where m.trip_id = p_trip_id and m.user_id = viaggio_identity.uid() and m.role = 'owner'
  ) then
    raise exception 'Somente o proprietário pode compartilhar esta viagem';
  end if;

  select * into target_user
  from viaggio_identity.users
  where lower(viaggio_identity.users.email) = lower(trim(p_email))
    and deleted_at is null
  limit 1;

  if target_user.id is null then
    raise exception 'Nenhuma conta Viaggio encontrada com este e-mail';
  end if;
  if target_user.id = viaggio_identity.uid() then
    raise exception 'Você já é o proprietário desta viagem';
  end if;

  insert into viaggio_app.trip_members(trip_id,user_id,role)
  values(p_trip_id,target_user.id,normalized_role)
  on conflict on constraint trip_members_pkey do update
    set role = excluded.role;

  return query select target_user.id, target_user.email::text, normalized_role;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.list_trip_members(p_trip_id uuid)
 RETURNS TABLE(user_id uuid, email text, role text, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'viaggio_app', 'viaggio_identity'
AS $function$
  select m.user_id, u.email::text, m.role,
         coalesce(p.name, u.raw_user_meta_data->>'name', split_part(u.email,'@',1))::text
  from viaggio_app.trip_members m
  join viaggio_identity.users u on u.id=m.user_id
  left join viaggio_app.passenger_profiles p on p.user_id=m.user_id
  where m.trip_id=p_trip_id
    and viaggio_app.is_trip_member(p_trip_id)
  order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, 4;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.invite_trip_by_email(p_trip_id uuid, p_email text, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_email text := lower(btrim(p_email));
  target_id uuid;
  owner_id uuid;
begin
  if viaggio_identity.uid() is null then raise exception 'Sessão inválida'; end if;
  select t.user_id into owner_id from viaggio_app.trips t where t.id = p_trip_id;
  if owner_id is distinct from viaggio_identity.uid() then raise exception 'Somente o proprietário pode compartilhar esta viagem'; end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized_email) > 254 then
    raise exception 'Informe um e-mail válido';
  end if;
  if p_role not in ('viewer', 'editor') then raise exception 'Permissão inválida'; end if;
  select u.id into target_id from viaggio_identity.users u where lower(u.email) = normalized_email and u.deleted_at is null limit 1;
  if target_id = viaggio_identity.uid() then raise exception 'Você já é o proprietário desta viagem'; end if;
  if target_id is null then
    insert into viaggio_app.trip_invitations(trip_id,email,role,invited_by)
    values (p_trip_id,normalized_email,p_role,viaggio_identity.uid())
    on conflict (trip_id,email) do update set role = excluded.role, invited_by = excluded.invited_by;
    return 'pending';
  end if;
  insert into viaggio_app.trip_members(trip_id,user_id,role) values(p_trip_id,target_id,p_role)
  on conflict (trip_id,user_id) do update set role = excluded.role;
  delete from viaggio_app.trip_invitations where trip_id = p_trip_id and email = normalized_email;
  return 'shared';
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.list_trip_shares(p_trip_id uuid)
 RETURNS TABLE(email text, role text, display_name text, pending boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if viaggio_identity.uid() is null or not exists (
    select 1 from viaggio_app.trips t where t.id = p_trip_id and t.user_id = viaggio_identity.uid()
  ) then raise exception 'Somente o proprietário pode consultar convites'; end if;
  return query
    select u.email::text, m.role,
      coalesce(p.name,split_part(u.email,'@',1))::text, false
    from viaggio_app.trip_members m join viaggio_identity.users u on u.id = m.user_id
    left join viaggio_app.passenger_profiles p on p.user_id = u.id
    where m.trip_id = p_trip_id and m.role <> 'owner'
    union all
    select i.email,i.role,null::text,true from viaggio_app.trip_invitations i where i.trip_id = p_trip_id
    order by 1;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.remove_trip_share(p_trip_id uuid, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if viaggio_identity.uid() is null or not exists (
    select 1 from viaggio_app.trips t where t.id = p_trip_id and t.user_id = viaggio_identity.uid()
  ) then raise exception 'Somente o proprietário pode remover o acesso'; end if;
  delete from viaggio_app.trip_invitations where trip_id = p_trip_id and email = lower(btrim(p_email));
  delete from viaggio_app.trip_members m using viaggio_identity.users u
    where m.trip_id = p_trip_id and m.user_id = u.id
      and lower(u.email) = lower(btrim(p_email)) and m.role <> 'owner';
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.compact_snapshot_photos(p_trip_id uuid, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app'
AS $function$
declare
  kind text := jsonb_typeof(p_value);
  member record;
  result jsonb;
  photo text;
  hash text;
begin
  if kind = 'string' then
    photo := p_value #>> '{}';
    if left(photo, 11) = 'data:image/' then
      hash := md5(photo);
      insert into viaggio_app.snapshot_photos (trip_id, photo_hash, photo_data)
      values (p_trip_id, hash, photo)
      on conflict (trip_id, photo_hash) do nothing;
      return jsonb_build_object('__viaggio_snapshot_photo__', hash);
    end if;
  elsif kind = 'object' then
    result := '{}'::jsonb;
    for member in select key, value from jsonb_each(p_value) loop
      result := result || jsonb_build_object(member.key,
        viaggio_app.compact_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  elsif kind = 'array' then
    result := '[]'::jsonb;
    for member in select value from jsonb_array_elements(p_value) loop
      result := result || jsonb_build_array(
        viaggio_app.compact_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  end if;
  return p_value;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.shared_trip_owners()
 RETURNS TABLE(trip_id uuid, owner_name text, avatar_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select t.id, coalesce(p.name, split_part(u.email,'@',1))::text, p.avatar_path
  from viaggio_app.trips t join viaggio_identity.users u on u.id = t.user_id
  left join viaggio_app.passenger_profiles p on p.user_id = t.user_id and p.is_deleted is not true
  where t.user_id <> viaggio_identity.uid() and t.deleted_at is null and viaggio_app.is_trip_member(t.id);
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.expand_snapshot_photos(p_trip_id uuid, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app'
AS $function$
declare
  kind text := jsonb_typeof(p_value);
  member record;
  result jsonb;
  photo text;
begin
  if kind = 'object' then
    if p_value ? '__viaggio_snapshot_photo__'
      and p_value = jsonb_build_object('__viaggio_snapshot_photo__',
        p_value->>'__viaggio_snapshot_photo__') then
      select photo_data into photo from viaggio_app.snapshot_photos
      where trip_id = p_trip_id
        and photo_hash = p_value->>'__viaggio_snapshot_photo__';
      if photo is null then
        raise exception 'Snapshot photo is missing';
      end if;
      return to_jsonb(photo);
    end if;
    result := '{}'::jsonb;
    for member in select key, value from jsonb_each(p_value) loop
      result := result || jsonb_build_object(member.key,
        viaggio_app.expand_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  elsif kind = 'array' then
    result := '[]'::jsonb;
    for member in select value from jsonb_array_elements(p_value) loop
      result := result || jsonb_build_array(
        viaggio_app.expand_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  end if;
  return p_value;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.fill_attachment_trip_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'viaggio_app'
AS $function$
begin
  if new.trip_id is null and new.day_id is not null then
    select d.trip_id into new.trip_id from viaggio_app.trip_days d where d.id = new.day_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION viaggio_app.snapshot_photo_value(p_trip_id uuid, p_photo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'viaggio_app'
AS $function$
declare
  hash text;
begin
  if p_photo is null then
    return 'null'::jsonb;
  end if;

  if left(p_photo, 11) <> 'data:image/' then
    return to_jsonb(p_photo);
  end if;

  hash := md5(p_photo);

  if not exists (
    select 1
    from viaggio_app.snapshot_photos
    where trip_id = p_trip_id
      and photo_hash = hash
  ) then
    insert into viaggio_app.snapshot_photos (trip_id, photo_hash, photo_data)
    values (p_trip_id, hash, p_photo)
    on conflict (trip_id, photo_hash) do nothing;
  end if;

  return jsonb_build_object('__viaggio_snapshot_photo__', hash);
end;
$function$
;

CREATE TRIGGER day_locations_created_at_guard BEFORE INSERT OR UPDATE ON viaggio_app.day_locations FOR EACH ROW EXECUTE FUNCTION ensure_day_location_created_at();

CREATE TRIGGER fill_attachment_trip_id_before_insert BEFORE INSERT ON viaggio_app.day_attachments FOR EACH ROW EXECUTE FUNCTION fill_attachment_trip_id();

CREATE POLICY "Usuário cria as próprias viagens" ON viaggio_app."trips" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((viaggio_identity.uid() = user_id));

CREATE POLICY "Usuário edita as próprias viagens" ON viaggio_app."trips" AS PERMISSIVE FOR UPDATE TO authenticated USING ((viaggio_identity.uid() = user_id)) WITH CHECK ((viaggio_identity.uid() = user_id));

CREATE POLICY "Usuário exclui as próprias viagens" ON viaggio_app."trips" AS PERMISSIVE FOR DELETE TO authenticated USING ((viaggio_identity.uid() = user_id));

CREATE POLICY "trip owner create" ON viaggio_app."trips" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = viaggio_identity.uid()));

CREATE POLICY "trip owner delete" ON viaggio_app."trips" AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = viaggio_identity.uid()));

CREATE POLICY "trip owner or editor edit" ON viaggio_app."trips" AS PERMISSIVE FOR UPDATE TO authenticated USING (is_trip_member(id, 'editor'::text)) WITH CHECK (is_trip_member(id, 'editor'::text));

CREATE POLICY "trip owner or member read" ON viaggio_app."trips" AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT viaggio_identity.uid() AS uid)) OR is_trip_member(id)));

CREATE POLICY "checklist edit" ON viaggio_app."checklist_items" AS PERMISSIVE FOR ALL TO authenticated USING (is_trip_member(trip_id, 'editor'::text)) WITH CHECK (is_trip_member(trip_id, 'editor'::text));

CREATE POLICY "checklist read" ON viaggio_app."checklist_items" AS PERMISSIVE FOR SELECT TO authenticated USING (is_trip_member(trip_id));

CREATE POLICY "budget edit" ON viaggio_app."budget_items" AS PERMISSIVE FOR ALL TO authenticated USING (is_trip_member(trip_id, 'editor'::text)) WITH CHECK (is_trip_member(trip_id, 'editor'::text));

CREATE POLICY "budget read" ON viaggio_app."budget_items" AS PERMISSIVE FOR SELECT TO authenticated USING (is_trip_member(trip_id));

CREATE POLICY "members owner add" ON viaggio_app."trip_members" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM trips t
  WHERE ((t.id = trip_members.trip_id) AND (t.user_id = viaggio_identity.uid())))));

CREATE POLICY "members owner delete" ON viaggio_app."trip_members" AS PERMISSIVE FOR DELETE TO authenticated USING (is_trip_member(trip_id, 'owner'::text));

CREATE POLICY "members owner edit" ON viaggio_app."trip_members" AS PERMISSIVE FOR UPDATE TO authenticated USING (is_trip_member(trip_id, 'owner'::text)) WITH CHECK (is_trip_member(trip_id, 'owner'::text));

CREATE POLICY "members read" ON viaggio_app."trip_members" AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = viaggio_identity.uid()) OR is_trip_member(trip_id, 'owner'::text)));

CREATE POLICY "passengers edit" ON viaggio_app."passengers" AS PERMISSIVE FOR ALL TO authenticated USING (is_trip_member(trip_id, 'editor'::text)) WITH CHECK (is_trip_member(trip_id, 'editor'::text));

CREATE POLICY "passengers read" ON viaggio_app."passengers" AS PERMISSIVE FOR SELECT TO authenticated USING (is_trip_member(trip_id));

CREATE POLICY "days edit" ON viaggio_app."trip_days" AS PERMISSIVE FOR ALL TO authenticated USING (is_trip_member(trip_id, 'editor'::text)) WITH CHECK (is_trip_member(trip_id, 'editor'::text));

CREATE POLICY "days read" ON viaggio_app."trip_days" AS PERMISSIVE FOR SELECT TO authenticated USING (is_trip_member(trip_id));

CREATE POLICY "activities edit" ON viaggio_app."activities" AS PERMISSIVE FOR ALL TO authenticated USING (is_trip_member(( SELECT d.trip_id
   FROM trip_days d
  WHERE (d.id = activities.day_id)), 'editor'::text)) WITH CHECK (is_trip_member(( SELECT d.trip_id
   FROM trip_days d
  WHERE (d.id = activities.day_id)), 'editor'::text));

CREATE POLICY "activities read" ON viaggio_app."activities" AS PERMISSIVE FOR SELECT TO authenticated USING (is_trip_member(( SELECT d.trip_id
   FROM trip_days d
  WHERE (d.id = activities.day_id))));

CREATE POLICY "passenger profile insert own" ON viaggio_app."passenger_profiles" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = viaggio_identity.uid()));

CREATE POLICY "passenger profile read own" ON viaggio_app."passenger_profiles" AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = viaggio_identity.uid()));

CREATE POLICY "passenger profile update own" ON viaggio_app."passenger_profiles" AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = viaggio_identity.uid())) WITH CHECK ((user_id = viaggio_identity.uid()));

CREATE POLICY "locations edit" ON viaggio_app."day_locations" AS PERMISSIVE FOR ALL TO authenticated USING (is_trip_member(( SELECT trip_days.trip_id
   FROM trip_days
  WHERE (trip_days.id = day_locations.day_id)), 'editor'::text)) WITH CHECK (is_trip_member(( SELECT trip_days.trip_id
   FROM trip_days
  WHERE (trip_days.id = day_locations.day_id)), 'editor'::text));

CREATE POLICY "locations read" ON viaggio_app."day_locations" AS PERMISSIVE FOR SELECT TO authenticated USING (is_trip_member(( SELECT trip_days.trip_id
   FROM trip_days
  WHERE (trip_days.id = day_locations.day_id))));

CREATE POLICY "saved passengers delete" ON viaggio_app."saved_passengers" AS PERMISSIVE FOR DELETE TO authenticated USING ((owner_id = ( SELECT viaggio_identity.uid() AS uid)));

CREATE POLICY "saved passengers insert" ON viaggio_app."saved_passengers" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((owner_id = ( SELECT viaggio_identity.uid() AS uid)));

CREATE POLICY "saved passengers read" ON viaggio_app."saved_passengers" AS PERMISSIVE FOR SELECT TO authenticated USING ((owner_id = ( SELECT viaggio_identity.uid() AS uid)));

CREATE POLICY "saved passengers update" ON viaggio_app."saved_passengers" AS PERMISSIVE FOR UPDATE TO authenticated USING ((owner_id = ( SELECT viaggio_identity.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT viaggio_identity.uid() AS uid)));

CREATE POLICY "day attachments delete for editors" ON viaggio_app."day_attachments" AS PERMISSIVE FOR DELETE TO authenticated USING (is_trip_member(trip_id, 'editor'::text));

CREATE POLICY "day attachments insert for editors" ON viaggio_app."day_attachments" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((created_by = ( SELECT viaggio_identity.uid() AS uid)) AND is_trip_member(trip_id, 'editor'::text) AND (split_part(storage_path, '/'::text, 1) = (trip_id)::text) AND (((day_id IS NULL) AND (split_part(storage_path, '/'::text, 2) = 'general'::text)) OR (EXISTS ( SELECT 1
   FROM trip_days d
  WHERE ((d.id = day_attachments.day_id) AND (d.trip_id = day_attachments.trip_id) AND (split_part(day_attachments.storage_path, '/'::text, 2) = (d.id)::text)))))));

CREATE POLICY "day attachments read for members" ON viaggio_app."day_attachments" AS PERMISSIVE FOR SELECT TO authenticated USING (is_trip_member(trip_id));

CREATE POLICY "change log insert own" ON viaggio_app."change_log" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = viaggio_identity.uid()));

CREATE POLICY "change log read own" ON viaggio_app."change_log" AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = viaggio_identity.uid()));

CREATE POLICY "snapshots read own" ON viaggio_app."state_snapshots" AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = viaggio_identity.uid()));

REVOKE ALL ON ALL TABLES IN SCHEMA viaggio_app, viaggio_identity FROM PUBLIC, anonymous;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA viaggio_app, viaggio_identity FROM PUBLIC, anonymous;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."trips" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."checklist_items" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."budget_items" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."trip_members" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."passengers" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."trip_days" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."activities" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."passenger_profiles" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."day_locations" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."saved_passengers" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."day_attachments" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."change_log" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON viaggio_app."state_snapshots" TO authenticated;

DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='viaggio_app' AND p.proname = ANY (ARRAY['is_trip_member','soft_delete_own_account','ensure_trip_baseline_snapshot','restore_trip_snapshot','capture_trip_snapshot','claim_trip_invitations','share_trip_with_email','list_trip_members','invite_trip_by_email','list_trip_shares','remove_trip_share','shared_trip_owners']) LOOP EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.signature||' TO authenticated'; END LOOP; END $$;

CREATE FUNCTION viaggio_identity.guard_trip_identity() RETURNS trigger
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
