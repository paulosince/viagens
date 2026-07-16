create table if not exists public.passenger_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  birth_date date,
  avatar_path text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.passenger_profiles add column if not exists is_deleted boolean not null default false;
alter table public.passenger_profiles add column if not exists deleted_at timestamptz;

alter table public.passengers add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists passengers_user_id_idx on public.passengers(user_id);

alter table public.passenger_profiles enable row level security;

drop policy if exists "passenger profile read own" on public.passenger_profiles;
create policy "passenger profile read own" on public.passenger_profiles
  for select using (user_id = auth.uid());

drop policy if exists "passenger profile insert own" on public.passenger_profiles;
create policy "passenger profile insert own" on public.passenger_profiles
  for insert with check (user_id = auth.uid());

drop policy if exists "passenger profile update own" on public.passenger_profiles;
create policy "passenger profile update own" on public.passenger_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "passenger update self" on public.passengers;
create policy "passenger update self" on public.passengers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp'];

drop policy if exists "profile photo read own" on storage.objects;
create policy "profile photo read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile photo insert own" on storage.objects;
create policy "profile photo insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile photo update own" on storage.objects;
create policy "profile photo update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop function if exists public.delete_own_account();

create or replace function public.soft_delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Sessão inválida'; end if;
  insert into public.passenger_profiles (user_id, name, is_deleted, deleted_at)
  select id, coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)), true, now()
  from auth.users where id = current_user_id
  on conflict (user_id) do update set is_deleted = true, deleted_at = now(), updated_at = now();
end;
$$;

revoke all on function public.soft_delete_own_account() from public;
grant execute on function public.soft_delete_own_account() to authenticated;
