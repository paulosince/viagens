-- Complemento idempotente para quem já criou public.day_locations.
-- Pode ser executado mais de uma vez com segurança.

alter table public.day_locations add column if not exists provider text;
alter table public.day_locations add column if not exists provider_place_id text;
alter table public.day_locations add column if not exists formatted_address text;
alter table public.day_locations add column if not exists latitude double precision;
alter table public.day_locations add column if not exists longitude double precision;
alter table public.day_locations add column if not exists category text;
alter table public.day_locations add column if not exists place_type text;
alter table public.day_locations add column if not exists photo_provider text;
alter table public.day_locations add column if not exists photo_author text;
alter table public.day_locations add column if not exists photo_author_url text;
alter table public.day_locations add column if not exists photo_source_url text;

create index if not exists day_locations_provider_place_idx
  on public.day_locations (provider, provider_place_id);

create table if not exists public.unsplash_search_cache (
  query text primary key,
  results jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.unsplash_search_cache enable row level security;
