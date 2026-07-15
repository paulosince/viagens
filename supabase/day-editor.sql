-- Execute uma vez no Supabase para habilitar o editor completo dos dias.
alter table public.trip_days add column if not exists main_place_name text;
alter table public.activities add column if not exists shopping_items text;
alter table public.activities add column if not exists meal text;
alter table public.activities add column if not exists transport text;
alter table public.activities add column if not exists notes text;
