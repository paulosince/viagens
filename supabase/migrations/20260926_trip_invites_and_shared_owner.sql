-- Invitations use the verified email in auth.users; no account lookup is exposed to callers.
create table if not exists public.trip_invitations (
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null,
  role text not null check (role in ('viewer', 'editor')),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (trip_id, email),
  check (email = lower(btrim(email)))
);
alter table public.trip_invitations enable row level security;
revoke all on public.trip_invitations from anon, authenticated;

drop policy if exists "Usuário vê as próprias viagens" on public.trips;
drop policy if exists "trip owner or member read" on public.trips;
create policy "trip owner or member read" on public.trips for select to authenticated
  using (user_id = (select auth.uid()) or public.is_trip_member(id));

-- The prior owner UPDATE policy is additive and cannot be used to grant viewers access.
-- Editors have UPDATE through "trip owner or editor edit"; deletion remains owner-only.

create or replace function public.invite_trip_by_email(p_trip_id uuid, p_email text, p_role text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(btrim(p_email));
  target_id uuid;
  owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select t.user_id into owner_id from public.trips t where t.id = p_trip_id;
  if owner_id is distinct from auth.uid() then raise exception 'Somente o proprietário pode compartilhar esta viagem'; end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized_email) > 254 then
    raise exception 'Informe um e-mail válido';
  end if;
  if p_role not in ('viewer', 'editor') then raise exception 'Permissão inválida'; end if;
  select u.id into target_id from auth.users u where lower(u.email) = normalized_email and u.deleted_at is null limit 1;
  if target_id = auth.uid() then raise exception 'Você já é o proprietário desta viagem'; end if;
  if target_id is null then
    insert into public.trip_invitations(trip_id,email,role,invited_by)
    values (p_trip_id,normalized_email,p_role,auth.uid())
    on conflict (trip_id,email) do update set role = excluded.role, invited_by = excluded.invited_by;
    return 'pending';
  end if;
  insert into public.trip_members(trip_id,user_id,role) values(p_trip_id,target_id,p_role)
  on conflict (trip_id,user_id) do update set role = excluded.role;
  delete from public.trip_invitations where trip_id = p_trip_id and email = normalized_email;
  return 'shared';
end;
$$;
revoke all on function public.invite_trip_by_email(uuid,text,text) from public,anon;
grant execute on function public.invite_trip_by_email(uuid,text,text) to authenticated;

create or replace function public.claim_trip_invitations()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  user_email text;
  claimed integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select lower(u.email) into user_email from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null;
  if user_email is null then return 0; end if;
  insert into public.trip_members(trip_id,user_id,role)
  select i.trip_id,auth.uid(),i.role from public.trip_invitations i
    join public.trips t on t.id = i.trip_id and t.user_id = i.invited_by
    where i.email = user_email
  on conflict (trip_id,user_id) do nothing;
  get diagnostics claimed = row_count;
  delete from public.trip_invitations where email = user_email;
  return claimed;
end;
$$;
revoke all on function public.claim_trip_invitations() from public,anon;
grant execute on function public.claim_trip_invitations() to authenticated;

create or replace function public.list_trip_shares(p_trip_id uuid)
returns table(email text, role text, display_name text, pending boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.trips t where t.id = p_trip_id and t.user_id = auth.uid()
  ) then raise exception 'Somente o proprietário pode consultar convites'; end if;
  return query
    select u.email::text, m.role,
      coalesce(p.name,split_part(u.email,'@',1))::text, false
    from public.trip_members m join auth.users u on u.id = m.user_id
    left join public.passenger_profiles p on p.user_id = u.id
    where m.trip_id = p_trip_id and m.role <> 'owner'
    union all
    select i.email,i.role,null::text,true from public.trip_invitations i where i.trip_id = p_trip_id
    order by 1;
end;
$$;
revoke all on function public.list_trip_shares(uuid) from public,anon;
grant execute on function public.list_trip_shares(uuid) to authenticated;

create or replace function public.remove_trip_share(p_trip_id uuid,p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.trips t where t.id = p_trip_id and t.user_id = auth.uid()
  ) then raise exception 'Somente o proprietário pode remover o acesso'; end if;
  delete from public.trip_invitations where trip_id = p_trip_id and email = lower(btrim(p_email));
  delete from public.trip_members m using auth.users u
    where m.trip_id = p_trip_id and m.user_id = u.id
      and lower(u.email) = lower(btrim(p_email)) and m.role <> 'owner';
end;
$$;
revoke all on function public.remove_trip_share(uuid,text) from public,anon;
grant execute on function public.remove_trip_share(uuid,text) to authenticated;

create or replace function public.shared_trip_owners()
returns table(trip_id uuid, owner_name text, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select t.id, coalesce(p.name, split_part(u.email,'@',1))::text, p.avatar_path
  from public.trips t join auth.users u on u.id = t.user_id
  left join public.passenger_profiles p on p.user_id = t.user_id and p.is_deleted is not true
  where t.user_id <> auth.uid() and t.deleted_at is null and public.is_trip_member(t.id);
$$;
revoke all on function public.shared_trip_owners() from public,anon;
grant execute on function public.shared_trip_owners() to authenticated;

-- Members can sign only the owner's profile picture for trips shared with them.
drop policy if exists "profile photo read shared trip owner" on storage.objects;
create policy "profile photo read shared trip owner" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and exists (
    select 1 from public.trips t
      where t.user_id::text = (storage.foldername(name))[1]
        and t.deleted_at is null and public.is_trip_member(t.id)
  ));
