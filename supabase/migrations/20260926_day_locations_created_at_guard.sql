create or replace function public.ensure_day_location_created_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_at := coalesce(
    new.created_at,
    case when tg_op = 'UPDATE' then old.created_at else null end,
    now()
  );
  return new;
end;
$$;

drop trigger if exists day_locations_created_at_guard on public.day_locations;
create trigger day_locations_created_at_guard
before insert or update on public.day_locations
for each row execute function public.ensure_day_location_created_at();

revoke all on function public.ensure_day_location_created_at() from public, anon, authenticated;
