create table if not exists public.saved_passengers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  birth_date date,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_passengers_owner_idx on public.saved_passengers (owner_id);
alter table public.saved_passengers enable row level security;

create policy "saved passengers read" on public.saved_passengers
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "saved passengers insert" on public.saved_passengers
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "saved passengers update" on public.saved_passengers
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "saved passengers delete" on public.saved_passengers
  for delete to authenticated using (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.saved_passengers to authenticated;

-- Keep the best available photo when the same person occurs in several trips.
insert into public.saved_passengers (owner_id, name, birth_date, photo_url)
select distinct on (t.user_id, lower(trim(p.name)), p.birth_date)
  t.user_id, trim(p.name), p.birth_date, p.photo_url
from public.passengers p
join public.trips t on t.id = p.trip_id
where trim(p.name) <> ''
  and (p.user_id is null or p.user_id <> t.user_id)
order by t.user_id, lower(trim(p.name)), p.birth_date,
  (nullif(p.photo_url, '') is not null) desc, p.created_at desc;
