create table if not exists public.day_locations (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.trip_days(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.day_locations enable row level security;

drop policy if exists "locations read" on public.day_locations;
create policy "locations read" on public.day_locations
for select using (
  public.is_trip_member((select trip_id from public.trip_days d where d.id = day_id))
);

drop policy if exists "locations edit" on public.day_locations;
create policy "locations edit" on public.day_locations
for all using (
  public.is_trip_member((select trip_id from public.trip_days d where d.id = day_id), 'editor')
)
with check (
  public.is_trip_member((select trip_id from public.trip_days d where d.id = day_id), 'editor')
);
