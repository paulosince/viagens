-- Keep the snapshot restore path aware of managed Storage media.
-- Older snapshots without these fields remain readable because jsonb_populate_recordset
-- simply yields null for fields that did not exist yet.

create or replace function public.restore_trip_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  uid uuid := auth.uid();
  snap public.state_snapshots%rowtype;
  safety_id uuid := gen_random_uuid();
  restored_id uuid := gen_random_uuid();
  log_id uuid := gen_random_uuid();
  trip_json jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into snap
  from public.state_snapshots
  where id = p_snapshot_id and user_id = uid;

  if not found then raise exception 'Snapshot not found'; end if;
  if not public.is_trip_member(snap.trip_id, 'owner') then
    raise exception 'Only a trip owner can restore a snapshot';
  end if;

  snap.state := public.expand_snapshot_photos(snap.trip_id, snap.state);
  perform public.capture_trip_snapshot(safety_id, snap.trip_id, 'Antes de restaurar ' || left(p_snapshot_id::text, 8));
  trip_json := snap.state->'trip';

  delete from public.checklist_items where trip_id = snap.trip_id;
  delete from public.budget_items where trip_id = snap.trip_id;
  delete from public.day_locations where day_id in (select id from public.trip_days where trip_id = snap.trip_id);
  delete from public.activities where day_id in (select id from public.trip_days where trip_id = snap.trip_id);
  delete from public.trip_days where trip_id = snap.trip_id;
  delete from public.passengers where trip_id = snap.trip_id;

  update public.trips
  set name = coalesce(trip_json->>'name', name),
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

  insert into public.passengers (
    id, trip_id, name, age, gender, photo_url, created_at, user_id, birth_date,
    photo_path, photo_hash, photo_updated_at
  )
  select id, trip_id, name, age, gender, photo_url, created_at, user_id, birth_date,
         photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::public.passengers, snap.state->'passengers');

  insert into public.trip_days (
    id, trip_id, title, summary, photo_url, status, position, is_hidden, deleted_at,
    photo_path, photo_hash, photo_updated_at
  )
  select id, trip_id, title, summary, photo_url, status, position, is_hidden, deleted_at,
         photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::public.trip_days, snap.state->'days');

  insert into public.day_locations (
    id, day_id, position, name, photo_url, created_at, provider, provider_place_id,
    formatted_address, latitude, longitude, category, place_type, photo_provider,
    photo_author, photo_author_url, photo_source_url, photo_path, photo_hash, photo_updated_at
  )
  select id, day_id, position, name, photo_url, created_at, provider, provider_place_id,
         formatted_address, latitude, longitude, category, place_type, photo_provider,
         photo_author, photo_author_url, photo_source_url, photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::public.day_locations, snap.state->'locations');

  insert into public.activities (
    id, day_id, period, position, title, description, place_name, address, latitude,
    longitude, place_id, photo_url, ticket_required, purchase_status, currency,
    planned_amount, actual_amount, exchange_rate, exchange_rate_date, shopping_items,
    meal, transport, notes, start_time, photo_path, photo_hash, photo_updated_at
  )
  select id, day_id, period, position, title, description, place_name, address, latitude,
         longitude, place_id, photo_url, ticket_required, purchase_status, currency,
         planned_amount, actual_amount, exchange_rate, exchange_rate_date, shopping_items,
         meal, transport, notes, start_time, photo_path, photo_hash, photo_updated_at
  from jsonb_populate_recordset(null::public.activities, snap.state->'activities');

  insert into public.checklist_items (id, trip_id, activity_id, label, due_at, completed)
  select id, trip_id, activity_id, label, due_at, completed
  from jsonb_populate_recordset(null::public.checklist_items, snap.state->'checklist_items');

  insert into public.budget_items (
    id, trip_id, activity_id, label, category, currency, planned_amount, actual_amount,
    exchange_rate, exchange_rate_date, purchase_status
  )
  select id, trip_id, activity_id, label, category, currency, planned_amount, actual_amount,
         exchange_rate, exchange_rate_date, purchase_status
  from jsonb_populate_recordset(null::public.budget_items, snap.state->'budget_items');

  perform public.capture_trip_snapshot(restored_id, snap.trip_id, 'Restaurado de ' || left(p_snapshot_id::text, 8));

  insert into public.change_log (
    id, user_id, trip_id, entity_type, entity_id, action, summary,
    before_state, after_state, snapshot_id
  )
  values (
    log_id, uid, snap.trip_id, 'trip', snap.trip_id::text, 'restore',
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
$function$;
