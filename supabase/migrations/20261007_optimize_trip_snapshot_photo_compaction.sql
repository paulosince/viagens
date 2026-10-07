create or replace function public.snapshot_photo_value(p_trip_id uuid, p_photo text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
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
    from public.snapshot_photos
    where trip_id = p_trip_id
      and photo_hash = hash
  ) then
    insert into public.snapshot_photos (trip_id, photo_hash, photo_data)
    values (p_trip_id, hash, p_photo)
    on conflict (trip_id, photo_hash) do nothing;
  end if;

  return jsonb_build_object('__viaggio_snapshot_photo__', hash);
end;
$$;

revoke all on function public.snapshot_photo_value(uuid, text) from public, anon, authenticated;
grant execute on function public.snapshot_photo_value(uuid, text) to service_role;

create or replace function public.capture_trip_snapshot(
  p_snapshot_id uuid,
  p_trip_id uuid,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
set statement_timeout = '30s'
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
    'trip',
      (to_jsonb(t) - 'cover_url')
      || jsonb_build_object('cover_url', public.snapshot_photo_value(p_trip_id, t.cover_url)),
    'passengers', coalesce((
      select jsonb_agg(
        (to_jsonb(p) - 'photo_url')
        || jsonb_build_object('photo_url', public.snapshot_photo_value(p_trip_id, p.photo_url))
        order by p.created_at, p.id
      )
      from public.passengers p
      where p.trip_id = p_trip_id
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(
        (to_jsonb(d) - 'photo_url')
        || jsonb_build_object('photo_url', public.snapshot_photo_value(p_trip_id, d.photo_url))
        order by d.position, d.id
      )
      from public.trip_days d
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(
        (to_jsonb(l) - 'photo_url')
        || jsonb_build_object('photo_url', public.snapshot_photo_value(p_trip_id, l.photo_url))
        order by d.position, l.position, l.id
      )
      from public.day_locations l
      join public.trip_days d on d.id = l.day_id
      where d.trip_id = p_trip_id
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(
        (to_jsonb(a) - 'photo_url')
        || jsonb_build_object('photo_url', public.snapshot_photo_value(p_trip_id, a.photo_url))
        order by d.position, a.position, a.id
      )
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

  insert into public.state_snapshots (id, user_id, trip_id, label, state)
  values (p_snapshot_id, uid, p_trip_id, p_label, payload)
  on conflict (id) do nothing;

  return p_snapshot_id;
end;
$$;
