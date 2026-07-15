create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  detail text not null default '',
  status text not null default 'Ainda sem roteiro',
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;

drop policy if exists "Usuário vê as próprias viagens" on public.trips;
create policy "Usuário vê as próprias viagens" on public.trips for select using (auth.uid() = user_id);
drop policy if exists "Usuário cria as próprias viagens" on public.trips;
create policy "Usuário cria as próprias viagens" on public.trips for insert with check (auth.uid() = user_id);
drop policy if exists "Usuário edita as próprias viagens" on public.trips;
create policy "Usuário edita as próprias viagens" on public.trips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Usuário exclui as próprias viagens" on public.trips;
create policy "Usuário exclui as próprias viagens" on public.trips for delete using (auth.uid() = user_id);

alter table public.trips alter column user_id set default auth.uid();
