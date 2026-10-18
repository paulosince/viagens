-- Neon collaboration laboratory, 2026-10-18.
-- Incoming JWT signatures, issuer/audience and role are verified by Neon Data API,
-- never by user-supplied IDs in an HTTP request body.
-- request.jwt.claims exists only inside a validated Data API request.
-- Keep this schema private from anonymous and unrelated database roles.

create or replace function viaggio_collab.actor_uid()
returns uuid
language plpgsql stable
security invoker
set search_path = ''
as $$
declare
  claims jsonb;
  subject text;
begin
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  if claims is null or claims->>'role' is distinct from 'authenticated' then
    return null;
  end if;
  subject := claims->>'sub';
  if subject is null or
     subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return subject::uuid;
end;
$$;

create or replace function viaggio_collab.can_view(p_trip uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
select exists (
  select 1 from viaggio_collab.trips t
  where t.id = p_trip
  and viaggio_collab.actor_uid() is not null
  and (
    t.owner_id = viaggio_collab.actor_uid()
    or exists (
      select 1 from viaggio_collab.members m
      where m.trip_id = t.id and m.member_id = viaggio_collab.actor_uid()
    )
  )
);
$$;

create or replace function viaggio_collab.can_edit(p_trip uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
select exists (
  select 1 from viaggio_collab.trips t
  where t.id = p_trip
  and viaggio_collab.actor_uid() is not null
  and (
    t.owner_id = viaggio_collab.actor_uid()
    or exists (
      select 1 from viaggio_collab.members m
      where m.trip_id = t.id
        and m.member_id = viaggio_collab.actor_uid()
        and m.access = 'editor'
    )
  )
);
$$;

create or replace function viaggio_collab.update_title(
  p_trip uuid, p_expected_revision integer, p_title text
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  new_revision integer;
begin
  if viaggio_collab.actor_uid() is null or not viaggio_collab.can_edit(p_trip) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'INVALID_REVISION' using errcode = '22023';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 150 then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;
  update viaggio_collab.trips t
     set title = btrim(p_title),
         revision = t.revision + 1,
         updated_at = clock_timestamp()
   where t.id = p_trip and t.revision = p_expected_revision
   returning t.revision into new_revision;
  if not found then
    raise exception 'REVISION_CONFLICT' using errcode = '40001';
  end if;
  return new_revision;
end;
$$;

create or replace function viaggio_collab.grant_access(
  p_trip uuid, p_member uuid, p_access text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := viaggio_collab.actor_uid();
begin
  if actor is null or p_member is null or p_member = actor
     or not exists (
       select 1 from viaggio_collab.trips t
        where t.id = p_trip and t.owner_id = actor
     ) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_access is null or p_access not in ('viewer','editor') then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;
  insert into viaggio_collab.members(trip_id,member_id,access)
    values(p_trip,p_member,p_access)
    on conflict (trip_id,member_id) do update set access = excluded.access;
  return true;
end;
$$;

create or replace function viaggio_collab.revoke_access(
  p_trip uuid, p_member uuid
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := viaggio_collab.actor_uid();
begin
  if actor is null or p_member is null
    or not exists (
      select 1 from viaggio_collab.trips t
      where t.id = p_trip and t.owner_id = actor
    ) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  delete from viaggio_collab.members m
  where m.trip_id = p_trip and m.member_id = p_member;
  return found;
end;
$$;

create or replace function viaggio_collab.current_actor()
returns uuid
language sql stable security definer set search_path = ''
as $$ select viaggio_collab.actor_uid() $$;

create or replace function viaggio_collab.is_project_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
select exists (
  select 1 from viaggio_collab.project_owner po
   where po.singleton = true and po.owner_id = viaggio_collab.actor_uid()
);
$$;

-- Do not expose legacy v1 diagnostics or broad permissions in the browser.
revoke all on function viaggio_collab.actor_uid() from public;
grant execute on function viaggio_collab.actor_uid() to authenticated;
revoke all on function viaggio_collab.can_view(uuid) from public;
revoke all on function viaggio_collab.can_edit(uuid) from public;
revoke all on function viaggio_collab.update_title(uuid, integer, text) from public;
revoke all on function viaggio_collab.grant_access(uuid, uuid, text) from public;
revoke all on function viaggio_collab.revoke_access(uuid, uuid) from public;
grant execute on function viaggio_collab.can_view(uuid) to authenticated;
grant execute on function viaggio_collab.can_edit(uuid) to authenticated;
grant execute on function viaggio_collab.update_title(uuid, integer, text) to authenticated;
grant execute on function viaggio_collab.grant_access(uuid, uuid, text) to authenticated;
grant execute on function viaggio_collab.revoke_access(uuid, uuid) to authenticated;
