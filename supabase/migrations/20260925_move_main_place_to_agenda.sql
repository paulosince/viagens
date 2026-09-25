-- Move the legacy day-level main place into agenda locations when needed,
-- then remove the redundant day-level field.

insert into public.day_locations (
  day_id,
  position,
  name
)
select
  d.id,
  coalesce((
    select max(l.position) + 1
    from public.day_locations l
    where l.day_id = d.id
  ), 0),
  d.main_place_name
from public.trip_days d
where d.main_place_name is not null
  and btrim(d.main_place_name) <> ''
  and not exists (
    select 1
    from public.day_locations l
    where l.day_id = d.id
      and lower(btrim(l.name)) = lower(btrim(d.main_place_name))
  );

alter table public.trip_days
  drop column if exists main_place_name;
