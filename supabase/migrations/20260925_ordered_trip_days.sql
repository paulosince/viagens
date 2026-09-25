-- Ordered trip days: dates are derived from trips.start_date + trip_days.position.
-- Legacy columns are kept nullable for backward compatibility during rollout.

alter table public.trips
  add column if not exists day_count integer;

update public.trips
set day_count = greatest(
  1,
  coalesce((end_date - start_date) + 1, 1)
)
where day_count is null;

alter table public.trips
  alter column day_count set default 1,
  alter column day_count set not null;

alter table public.trips
  drop constraint if exists trips_dates_valid;

alter table public.trips
  add constraint trips_day_count_positive
  check (day_count between 1 and 365) not valid;

alter table public.trips
  validate constraint trips_day_count_positive;

alter table public.trip_days
  add column if not exists position integer,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists deleted_at timestamptz;

update public.trip_days
set position = greatest(coalesce(day_number, 1) - 1, 0)
where position is null;

update public.trip_days
set is_hidden = true
where status = 'hidden';

alter table public.trip_days
  alter column position set default 0,
  alter column position set not null;

alter table public.trip_days
  drop constraint if exists trip_days_trip_id_day_number_key,
  drop constraint if exists trip_days_trip_id_date_key;

drop index if exists public.trip_days_trip_position_active_unique;
create unique index trip_days_trip_position_active_unique
  on public.trip_days (trip_id, position)
  where deleted_at is null;

alter table public.activities
  add column if not exists start_time time without time zone;

update public.activities
set start_time = starts_at::time
where start_time is null
  and starts_at is not null;

-- The active model no longer stores redundant calendar dates.
alter table public.activities
  drop column if exists starts_at;

alter table public.trip_days
  drop column if exists day_number,
  drop column if exists date;

alter table public.trips
  drop column if exists end_date;

comment on column public.trips.day_count is
  'Number of positions in the trip. End date is derived from start_date + day_count - 1.';

comment on column public.trip_days.position is
  'Zero-based order inside the trip. Calendar date is derived from the parent trip start_date.';

comment on column public.trip_days.is_hidden is
  'Temporarily hidden because the trip was shortened. Preserves all attached content.';

comment on column public.trip_days.deleted_at is
  'Soft deletion timestamp. Eligible for permanent purge after 30 days.';

comment on column public.activities.start_time is
  'Clock time within the owning day. No calendar date is stored here.';
