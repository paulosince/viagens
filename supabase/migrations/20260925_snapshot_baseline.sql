create or replace function public.ensure_trip_baseline_snapshot(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  snapshot_id uuid;
  log_id uuid := gen_random_uuid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_trip_member(p_trip_id, 'editor') then
    raise exception 'Not authorized for this trip';
  end if;

  select id
  into snapshot_id
  from public.state_snapshots
  where user_id = uid
    and trip_id = p_trip_id
  order by created_at asc
  limit 1;

  if snapshot_id is not null then
    return snapshot_id;
  end if;

  snapshot_id := gen_random_uuid();
  perform public.capture_trip_snapshot(
    snapshot_id,
    p_trip_id,
    'Ponto de segurança inicial'
  );

  insert into public.change_log (
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
$$;

revoke all on function public.ensure_trip_baseline_snapshot(uuid) from public, anon;
grant execute on function public.ensure_trip_baseline_snapshot(uuid) to authenticated;
