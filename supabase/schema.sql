create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination text not null default '',
  start_date date not null,
  end_date date not null,
  arrival_method text,
  location_label text,
  latitude numeric,
  longitude numeric,
  cover_url text,
  theme_id text not null default 'classic',
  primary_color text not null default '#14212b',
  secondary_color text not null default '#b89d63',
  created_at timestamptz not null default now(),
  constraint trips_dates_valid check (end_date >= start_date)
);

create table if not exists public.passengers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  age integer,
  gender text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null,
  date date not null,
  title text,
  summary text,
  photo_url text,
  status text not null default 'empty',
  unique(trip_id, day_number),
  unique(trip_id, date)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.trip_days(id) on delete cascade,
  period text not null check (period in ('morning','afternoon','night')),
  position integer not null default 0,
  title text not null,
  description text,
  starts_at timestamptz,
  place_name text,
  address text,
  latitude numeric,
  longitude numeric,
  place_id text,
  photo_url text,
  ticket_required boolean not null default false,
  purchase_status text not null default 'not_needed',
  currency text not null default 'BRL',
  planned_amount numeric(12,2),
  actual_amount numeric(12,2),
  exchange_rate numeric(14,6),
  exchange_rate_date date
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  label text not null,
  due_at timestamptz,
  completed boolean not null default false
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  label text not null,
  category text,
  currency text not null default 'BRL',
  planned_amount numeric(12,2),
  actual_amount numeric(12,2),
  exchange_rate numeric(14,6),
  exchange_rate_date date,
  purchase_status text not null default 'pending'
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','editor','owner')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create or replace function public.is_trip_member(target_trip uuid, minimum_role text default 'viewer')
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = target_trip and m.user_id = auth.uid()
      and case minimum_role when 'viewer' then m.role in ('viewer','editor','owner')
           when 'editor' then m.role in ('editor','owner')
           when 'owner' then m.role = 'owner' end
  );
$$;

alter table public.trips enable row level security;
alter table public.passengers enable row level security;
alter table public.trip_days enable row level security;
alter table public.activities enable row level security;
alter table public.checklist_items enable row level security;
alter table public.budget_items enable row level security;
alter table public.trip_members enable row level security;

drop policy if exists "trip owner or member read" on public.trips;
create policy "trip owner or member read" on public.trips for select using (user_id = auth.uid() or public.is_trip_member(id));
drop policy if exists "trip owner create" on public.trips;
create policy "trip owner create" on public.trips for insert with check (user_id = auth.uid());
drop policy if exists "trip owner edit" on public.trips;
create policy "trip owner edit" on public.trips for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "trip owner delete" on public.trips;
create policy "trip owner delete" on public.trips for delete using (user_id = auth.uid());

create policy "passengers read" on public.passengers for select using (public.is_trip_member(trip_id));
create policy "passengers edit" on public.passengers for all using (public.is_trip_member(trip_id,'editor')) with check (public.is_trip_member(trip_id,'editor'));
create policy "days read" on public.trip_days for select using (public.is_trip_member(trip_id));
create policy "days edit" on public.trip_days for all using (public.is_trip_member(trip_id,'editor')) with check (public.is_trip_member(trip_id,'editor'));
create policy "activities read" on public.activities for select using (public.is_trip_member((select trip_id from public.trip_days d where d.id = day_id)));
create policy "activities edit" on public.activities for all using (public.is_trip_member((select trip_id from public.trip_days d where d.id = day_id),'editor')) with check (public.is_trip_member((select trip_id from public.trip_days d where d.id = day_id),'editor'));
create policy "checklist read" on public.checklist_items for select using (public.is_trip_member(trip_id));
create policy "checklist edit" on public.checklist_items for all using (public.is_trip_member(trip_id,'editor')) with check (public.is_trip_member(trip_id,'editor'));
create policy "budget read" on public.budget_items for select using (public.is_trip_member(trip_id));
create policy "budget edit" on public.budget_items for all using (public.is_trip_member(trip_id,'editor')) with check (public.is_trip_member(trip_id,'editor'));

create policy "members read" on public.trip_members for select using (user_id = auth.uid() or public.is_trip_member(trip_id,'owner'));
create policy "members owner add" on public.trip_members for insert with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));
create policy "members owner edit" on public.trip_members for update using (public.is_trip_member(trip_id,'owner')) with check (public.is_trip_member(trip_id,'owner'));
create policy "members owner delete" on public.trip_members for delete using (public.is_trip_member(trip_id,'owner'));

insert into public.trip_members (trip_id, user_id, role)
select id, user_id, 'owner' from public.trips
on conflict (trip_id, user_id) do nothing;
