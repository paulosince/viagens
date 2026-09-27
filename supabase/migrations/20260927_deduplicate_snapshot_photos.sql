-- Keep snapshot restoration exact while storing each photo only once per trip.
-- Deploy after the project leaves read-only mode. Existing snapshots are
-- compacted separately by the recovery script, after a verified backup.
create table if not exists public.snapshot_photos (
  trip_id uuid not null references public.trips(id) on delete cascade,
  photo_hash text not null,
  photo_data text not null,
  primary key (trip_id, photo_hash)
);

alter table public.snapshot_photos enable row level security;
revoke all on public.snapshot_photos from public, anon, authenticated;

create or replace function public.compact_snapshot_photos(p_trip_id uuid, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      insert into public.snapshot_photos (trip_id, photo_hash, photo_data)
      values (p_trip_id, hash, photo)
      on conflict (trip_id, photo_hash) do nothing;
      return jsonb_build_object('__viaggio_snapshot_photo__', hash);
    end if;
  elsif kind = 'object' then
    result := '{}'::jsonb;
    for member in select key, value from jsonb_each(p_value) loop
      result := result || jsonb_build_object(member.key,
        public.compact_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  elsif kind = 'array' then
    result := '[]'::jsonb;
    for member in select value from jsonb_array_elements(p_value) loop
      result := result || jsonb_build_array(
        public.compact_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  end if;
  return p_value;
end;
$$;

create or replace function public.expand_snapshot_photos(p_trip_id uuid, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      select photo_data into photo from public.snapshot_photos
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
        public.expand_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  elsif kind = 'array' then
    result := '[]'::jsonb;
    for member in select value from jsonb_array_elements(p_value) loop
      result := result || jsonb_build_array(
        public.expand_snapshot_photos(p_trip_id, member.value));
    end loop;
    return result;
  end if;
  return p_value;
end;
$$;

revoke all on function public.compact_snapshot_photos(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.expand_snapshot_photos(uuid, jsonb) from public, anon, authenticated;

-- The two RPCs below are the original snapshot functions with one change
-- each: compact before INSERT, expand after loading for a restore.
create or replace function public.capture_trip_snapshot(
  p_snapshot_id uuid,
  p_trip_id uuid,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  payload jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_trip_member(p_trip_id, 'editor') then
    raise exception 'Not authorized for this trip';
  end if;

  select jsonb_build_object(
    'trip', to_jsonb(t),
    'passengers', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at, p.id)
      from public.passengers p
      where p.trip_id = p_trip_id
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.position, d.id)
      from public.trip_days d
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(to_jsonb(l) order by d.position, l.position, l.id)
      from public.day_locations l
      join public.trip_days d on d.id = l.day_id
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(to_jsonb(a) order by d.position, a.position, a.id)
      from public.activities a
      join public.trip_days d on d.id = a.day_id
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'checklist_items', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.id)
      from public.checklist_items c
      where c.trip_id = p_trip_id
    ), '[]'::jsonb),
    'budget_items', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.id)
      from public.budget_items b
      where b.trip_id = p_trip_id
    ), '[]'::jsonb)
  )
  into payload
  from public.trips t
  where t.id = p_trip_id;

  if payload is null then
    raise exception 'Trip not found';
  end if;

  payload := public.compact_snapshot_photos(p_trip_id, payload);

  insert into public.state_snapshots (id, user_id, trip_id, label, state)
  values (p_snapshot_id, uid, p_trip_id, p_label, payload)
  on conflict (id) do nothing;

  return p_snapshot_id;
end;
$$;

revoke all on function public.capture_trip_snapshot(uuid, uuid, text) from public, anon;
grant execute on function public.capture_trip_snapshot(uuid, uuid, text) to authenticated;
alter function public.capture_trip_snapshot(uuid, uuid, text) set statement_timeout to '30s';

create or replace function public.restore_trip_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  snap public.state_snapshots%rowtype;
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
  from public.state_snapshots
  where id = p_snapshot_id
    and user_id = uid;

  if not found then
    raise exception 'Snapshot not found';
  end if;

  if not public.is_trip_member(snap.trip_id, 'owner') then
    raise exception 'Only a trip owner can restore a snapshot';
  end if;

  snap.state := public.expand_snapshot_photos(snap.trip_id, snap.state);

  perform public.capture_trip_snapshot(
    safety_id,
    snap.trip_id,
    'Antes de restaurar ' || left(p_snapshot_id::text, 8)
  );

  trip_json := snap.state->'trip';

  delete from public.checklist_items where trip_id = snap.trip_id;
  delete from public.budget_items where trip_id = snap.trip_id;
  delete from public.day_locations
    where day_id in (select id from public.trip_days where trip_id = snap.trip_id);
  delete from public.activities
    where day_id in (select id from public.trip_days where trip_id = snap.trip_id);
  delete from public.trip_days where trip_id = snap.trip_id;
  delete from public.passengers where trip_id = snap.trip_id;

  update public.trips
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
    theme_id = coalesce(trip_json->>'theme_id', theme_id),
    primary_color = coalesce(trip_json->>'primary_color', primary_color),
    secondary_color = coalesce(trip_json->>'secondary_color', secondary_color),
    deleted_at = nullif(trip_json->>'deleted_at', '')::timestamptz,
    day_count = coalesce(nullif(trip_json->>'day_count', '')::integer, day_count)
  where id = snap.trip_id;

  insert into public.passengers (
    id, trip_id, name, age, gender, photo_url, created_at, user_id, birth_date
  )
  select id, trip_id, name, age, gender, photo_url, created_at, user_id, birth_date
  from jsonb_populate_recordset(null::public.passengers, snap.state->'passengers');

  insert into public.trip_days (
    id, trip_id, title, summary, photo_url, status, position, is_hidden, deleted_at
  )
  select id, trip_id, title, summary, photo_url, status, position, is_hidden, deleted_at
  from jsonb_populate_recordset(null::public.trip_days, snap.state->'days');

  insert into public.day_locations (
    id, day_id, position, name, photo_url, created_at, provider, provider_place_id,
    formatted_address, latitude, longitude, category, place_type, photo_provider,
    photo_author, photo_author_url, photo_source_url
  )
  select id, day_id, position, name, photo_url, created_at, provider, provider_place_id,
    formatted_address, latitude, longitude, category, place_type, photo_provider,
    photo_author, photo_author_url, photo_source_url
  from jsonb_populate_recordset(null::public.day_locations, snap.state->'locations');

  insert into public.activities (
    id, day_id, period, position, title, description, place_name, address, latitude,
    longitude, place_id, photo_url, ticket_required, purchase_status, currency,
    planned_amount, actual_amount, exchange_rate, exchange_rate_date, shopping_items,
    meal, transport, notes, start_time
  )
  select id, day_id, period, position, title, description, place_name, address, latitude,
    longitude, place_id, photo_url, ticket_required, purchase_status, currency,
    planned_amount, actual_amount, exchange_rate, exchange_rate_date, shopping_items,
    meal, transport, notes, start_time
  from jsonb_populate_recordset(null::public.activities, snap.state->'activities');

  insert into public.checklist_items (
    id, trip_id, activity_id, label, due_at, completed
  )
  select id, trip_id, activity_id, label, due_at, completed
  from jsonb_populate_recordset(null::public.checklist_items, snap.state->'checklist_items');

  insert into public.budget_items (
    id, trip_id, activity_id, label, category, currency, planned_amount, actual_amount,
    exchange_rate, exchange_rate_date, purchase_status
  )
  select id, trip_id, activity_id, label, category, currency, planned_amount, actual_amount,
    exchange_rate, exchange_rate_date, purchase_status
  from jsonb_populate_recordset(null::public.budget_items, snap.state->'budget_items');

  perform public.capture_trip_snapshot(
    restored_id,
    snap.trip_id,
    'Restaurado de ' || left(p_snapshot_id::text, 8)
  );

  insert into public.change_log (
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
$$;

revoke all on function public.restore_trip_snapshot(uuid) from public, anon;
grant execute on function public.restore_trip_snapshot(uuid) to authenticated;
