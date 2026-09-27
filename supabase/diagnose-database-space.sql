-- Execute in the Supabase SQL Editor. Read-only: returns counts and sizes,
-- never names, photos, file contents, or other personal data.
-- Run each SELECT separately if the editor times out.

-- 1. Physical table and index sizes. TOAST storage is included in total_bytes.
select
  n.nspname as schema_name,
  c.relname as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_total_relation_size(c.oid) as total_bytes,
  pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
  c.reltuples::bigint as approximate_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname in ('public', 'storage', 'auth')
order by pg_total_relation_size(c.oid) desc
limit 25;

-- 2. Snapshot count and stored JSON size, grouped without exposing trip IDs.
select
  count(*) as snapshots,
  count(distinct trip_id) as trips_with_snapshots,
  pg_size_pretty(coalesce(sum(pg_column_size(state)), 0)::bigint) as snapshot_json_size,
  coalesce(sum(pg_column_size(state)), 0)::bigint as snapshot_json_bytes,
  pg_size_pretty(coalesce(max(pg_column_size(state)), 0)::bigint) as largest_snapshot
from public.state_snapshots;

-- 3. Approximate bytes of image data embedded directly in active records.
-- Images held in Storage are not counted here or in the database size alert.
select source, image_count, pg_size_pretty(image_bytes) as image_size, image_bytes
from (
  select 'trips.cover_url' as source, count(*) filter (where cover_url like 'data:image/%') as image_count,
    coalesce(sum(octet_length(cover_url)) filter (where cover_url like 'data:image/%'), 0)::bigint as image_bytes
  from public.trips
  union all
  select 'trip_days.photo_url', count(*) filter (where photo_url like 'data:image/%'),
    coalesce(sum(octet_length(photo_url)) filter (where photo_url like 'data:image/%'), 0)::bigint
  from public.trip_days
  union all
  select 'day_locations.photo_url', count(*) filter (where photo_url like 'data:image/%'),
    coalesce(sum(octet_length(photo_url)) filter (where photo_url like 'data:image/%'), 0)::bigint
  from public.day_locations
  union all
  select 'activities.photo_url', count(*) filter (where photo_url like 'data:image/%'),
    coalesce(sum(octet_length(photo_url)) filter (where photo_url like 'data:image/%'), 0)::bigint
  from public.activities
  union all
  select 'passengers.photo_url', count(*) filter (where photo_url like 'data:image/%'),
    coalesce(sum(octet_length(photo_url)) filter (where photo_url like 'data:image/%'), 0)::bigint
  from public.passengers
) images
order by image_bytes desc;

-- 4. Change history can also contain images in before_state / after_state.
select
  count(*) as history_entries,
  pg_size_pretty(coalesce(sum(coalesce(pg_column_size(before_state), 0) + coalesce(pg_column_size(after_state), 0)), 0)::bigint) as history_json_size,
  coalesce(sum(coalesce(pg_column_size(before_state), 0) + coalesce(pg_column_size(after_state), 0)), 0)::bigint as history_json_bytes
from public.change_log;
