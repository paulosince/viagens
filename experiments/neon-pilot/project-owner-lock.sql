-- Viaggio/Neon lab: vinculo INALTERAVEL de propriedade do projeto.
-- Somente administrador/automacao de provisionamento estabelece o owner_id;
-- nunca permitir que um usuario reivindique projeto via endpoint publico.
create table if not exists viaggio_collab.project_owner (
  singleton boolean primary key default true check(singleton=true),
  owner_id uuid not null unique,
  provisioned_at timestamptz not null default now()
);

create or replace function viaggio_collab.current_actor()
returns uuid language sql stable security definer set search_path=''
as $$ select auth.uid() $$;

create or replace function viaggio_collab.is_project_owner()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from viaggio_collab.project_owner p
  where p.singleton=true and p.owner_id=auth.uid()
 );
$$;

drop policy if exists trip_new on viaggio_collab.trips;
create policy trip_new on viaggio_collab.trips
for insert to authenticated
with check (
  owner_id=viaggio_collab.current_actor()
  and viaggio_collab.is_project_owner()
);

-- Guest invitations, read and write RPCs remain scoped to a trip.
-- This policy prevents an authenticated outsider from creating "their" trip
-- in another person's database.
revoke all on viaggio_collab.project_owner from public;
revoke all on viaggio_collab.project_owner from authenticated;
revoke all on function viaggio_collab.current_actor() from public;
revoke all on function viaggio_collab.is_project_owner() from public;
grant execute on function viaggio_collab.current_actor() to authenticated;
grant execute on function viaggio_collab.is_project_owner() to authenticated;
alter table viaggio_collab.project_owner enable row level security;
