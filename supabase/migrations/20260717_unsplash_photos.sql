-- Complemento idempotente para fotos escolhidas no Unsplash.

alter table public.day_locations add column if not exists photo_provider text;
alter table public.day_locations add column if not exists photo_author text;
alter table public.day_locations add column if not exists photo_author_url text;
alter table public.day_locations add column if not exists photo_source_url text;

create table if not exists public.unsplash_search_cache (
  query text primary key,
  results jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.unsplash_search_cache enable row level security;
