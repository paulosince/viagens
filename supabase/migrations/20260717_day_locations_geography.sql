-- Complemento idempotente para quem já criou public.day_locations.
-- Pode ser executado mais de uma vez com segurança.

alter table public.day_locations add column if not exists provider text;
alter table public.day_locations add column if not exists provider_place_id text;
alter table public.day_locations add column if not exists formatted_address text;
alter table public.day_locations add column if not exists latitude double precision;
alter table public.day_locations add column if not exists longitude double precision;
alter table public.day_locations add column if not exists category text;
alter table public.day_locations add column if not exists place_type text;

create index if not exists day_locations_provider_place_idx
  on public.day_locations (provider, provider_place_id);
