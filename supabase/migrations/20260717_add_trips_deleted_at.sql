alter table public.trips add column if not exists deleted_at timestamptz;
