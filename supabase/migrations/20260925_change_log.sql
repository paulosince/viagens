create table if not exists public.change_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists change_log_user_created_idx
  on public.change_log (user_id, created_at desc);

create index if not exists change_log_trip_created_idx
  on public.change_log (trip_id, created_at desc);

alter table public.change_log enable row level security;

drop policy if exists "change log read own" on public.change_log;
create policy "change log read own"
  on public.change_log
  for select
  using (user_id = auth.uid());

drop policy if exists "change log insert own" on public.change_log;
create policy "change log insert own"
  on public.change_log
  for insert
  with check (user_id = auth.uid());
