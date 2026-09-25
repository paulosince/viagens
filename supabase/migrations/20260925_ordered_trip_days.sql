-- Ordered trip days: dates are derived from trips.start_date + trip_days.position.
-- The frontend supports the legacy schema during rollout; this migration removes
-- the redundant stored date columns once applied.

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


-- Permanently purge soft-deleted days and their day-owned dependent records
-- after the 30-day recovery window.
create extension if not exists pg_cron;

create or replace function public.purge_expired_trip_days()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count integer := 0;
begin
  delete from public.checklist_items
  where activity_id in (
    select a.id
    from public.activities a
    join public.trip_days d on d.id = a.day_id
    where d.deleted_at < now() - interval '30 days'
  );

  delete from public.budget_items
  where activity_id in (
    select a.id
    from public.activities a
    join public.trip_days d on d.id = a.day_id
    where d.deleted_at < now() - interval '30 days'
  );

  delete from public.trip_days
  where deleted_at < now() - interval '30 days';

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

revoke all on function public.purge_expired_trip_days() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'purge_deleted_trip_days_30d'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'purge_deleted_trip_days_30d',
  '23 4 * * *',
  $cron$select public.purge_expired_trip_days();$cron$
);
