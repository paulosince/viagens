-- Viaggio / Neon — colaboração entre projetos isolados (somente laboratório).
-- Publicar na Data API SOMENTE depois de aplicar e testar RLS.
-- Identidade: JWT "sub" do Supabase Auth, validado pelo Neon Data API.
-- O projeto do proprietário mantém todos os dados da viagem.
-- O convidado usa o MESMO JWT no endpoint do projeto anfitrião.
create schema if not exists viaggio_collab;

create table if not exists viaggio_collab.trips (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 title text not null check (char_length(btrim(title)) between 1 and 150),
 revision integer not null default 1 check (revision>=1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists viaggio_collab.members (
 trip_id uuid not null references viaggio_collab.trips(id) on delete cascade,
 member_id uuid not null,
 access text not null check (access in ('viewer','editor')),
 created_at timestamptz not null default now(),
 primary key (trip_id,member_id)
);
create index if not exists members_by_user on viaggio_collab.members(member_id,trip_id);
create table if not exists viaggio_collab.deadlines (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references viaggio_collab.trips(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 160),
 due_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists deadlines_by_trip on viaggio_collab.deadlines(trip_id);

-- SECURITY DEFINER tem apenas funções que obtêm a identidade do JWT;
-- não aceita IDs de solicitante fornecidos pelo navegador.
create or replace function viaggio_collab.can_view(p_trip uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
select exists (
 select 1 from viaggio_collab.trips t
 where t.id=p_trip and (
 t.owner_id = auth.uid()
 or exists (select 1 from viaggio_collab.members m
    where m.trip_id=t.id and m.member_id=auth.uid())
 )
);
$$;
create or replace function viaggio_collab.can_edit(p_trip uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
select exists (
 select 1 from viaggio_collab.trips t
 where t.id=p_trip and (
 t.owner_id=auth.uid()
 or exists (select 1 from viaggio_collab.members m
   where m.trip_id=t.id and m.member_id=auth.uid()
     and m.access='editor')
 )
);
$$;
create or replace function viaggio_collab.update_title(
 p_trip uuid, p_expected_revision integer, p_title text
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare updated_revision integer;
begin
 if auth.uid() is null or not viaggio_collab.can_edit(p_trip) then
   raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 150 then
   raise exception 'INVALID_TITLE';
 end if;
 update viaggio_collab.trips t set
   title=p_title, revision=revision+1, updated_at=clock_timestamp()
 where t.id=p_trip and t.revision=p_expected_revision
 returning t.revision into updated_revision;
 if not found then raise exception 'REVISION_CONFLICT'; end if;
 return updated_revision;
end;
$$;
create or replace function viaggio_collab.grant_access(
 p_trip uuid, p_member uuid, p_access text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or p_member is null or p_member=auth.uid()
 or not exists (select 1 from viaggio_collab.trips
   where id=p_trip and owner_id=auth.uid()) then
   raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 if p_access not in ('viewer','editor') then
  raise exception 'INVALID_ROLE';
 end if;
 insert into viaggio_collab.members(trip_id,member_id,access)
 values(p_trip,p_member,p_access)
 on conflict (trip_id,member_id) do update set access=excluded.access;
 return true;
end;
$$;
create or replace function viaggio_collab.revoke_access(
 p_trip uuid, p_member uuid
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not exists (
  select 1 from viaggio_collab.trips
  where id=p_trip and owner_id=auth.uid()) then
    raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 delete from viaggio_collab.members where trip_id=p_trip and member_id=p_member;
 return found;
end;
$$;

alter table viaggio_collab.trips enable row level security;
alter table viaggio_collab.members enable row level security;
alter table viaggio_collab.deadlines enable row level security;
drop policy if exists trip_read on viaggio_collab.trips;
create policy trip_read on viaggio_collab.trips for select to authenticated
 using (viaggio_collab.can_view(id));
drop policy if exists trip_new on viaggio_collab.trips;
create policy trip_new on viaggio_collab.trips for insert to authenticated
 with check (owner_id=auth.uid());
drop policy if exists member_read on viaggio_collab.members;
create policy member_read on viaggio_collab.members for select to authenticated
 using (viaggio_collab.can_view(trip_id));
drop policy if exists deadline_read on viaggio_collab.deadlines;
create policy deadline_read on viaggio_collab.deadlines for select to authenticated
 using (viaggio_collab.can_view(trip_id));
drop policy if exists deadline_add on viaggio_collab.deadlines;
create policy deadline_add on viaggio_collab.deadlines for insert to authenticated
 with check (viaggio_collab.can_edit(trip_id));

-- Apenas leituras básicas e inserção de novas viagens/deadlines.
-- Edição protegida por RPC com revision check; membership apenas por RPC.
revoke all on schema viaggio_collab from public;
revoke all on all tables in schema viaggio_collab from public;
revoke all on all functions in schema viaggio_collab from public;
grant usage on schema viaggio_collab to authenticated;
grant select,insert on viaggio_collab.trips to authenticated;
grant select on viaggio_collab.members to authenticated;
grant select,insert on viaggio_collab.deadlines to authenticated;
grant execute on function viaggio_collab.can_view(uuid) to authenticated;
grant execute on function viaggio_collab.can_edit(uuid) to authenticated;
grant execute on function viaggio_collab.update_title(uuid,integer,text) to authenticated;
grant execute on function viaggio_collab.grant_access(uuid,uuid,text) to authenticated;
grant execute on function viaggio_collab.revoke_access(uuid,uuid) to authenticated;

-- Banco privado: nenhum papel da API recebe qualquer privilégio no
-- esquema legado de viagens, controles de cota ou metadados internos.
revoke all on schema viaggio_lab from authenticated;
