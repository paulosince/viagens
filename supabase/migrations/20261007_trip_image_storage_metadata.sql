alter table public.trips
  add column if not exists cover_path text,
  add column if not exists cover_hash text,
  add column if not exists cover_updated_at timestamptz;

alter table public.passengers
  add column if not exists photo_path text,
  add column if not exists photo_hash text,
  add column if not exists photo_updated_at timestamptz;

alter table public.trip_days
  add column if not exists photo_path text,
  add column if not exists photo_hash text,
  add column if not exists photo_updated_at timestamptz;

alter table public.day_locations
  add column if not exists photo_path text,
  add column if not exists photo_hash text,
  add column if not exists photo_updated_at timestamptz;

alter table public.activities
  add column if not exists photo_path text,
  add column if not exists photo_hash text,
  add column if not exists photo_updated_at timestamptz;

alter table public.saved_passengers
  add column if not exists photo_path text,
  add column if not exists photo_hash text,
  add column if not exists photo_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-images',
  'trip-images',
  false,
  12582912,
  array['image/webp','image/jpeg','image/png']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "trip image read for members" on storage.objects;
create policy "trip image read for members"
on storage.objects for select to authenticated
using (
  bucket_id = 'trip-images'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(name))[1]
      and public.is_trip_member(t.id)
  )
);

drop policy if exists "trip image insert for editors" on storage.objects;
create policy "trip image insert for editors"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trip-images'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
);

drop policy if exists "trip image update for editors" on storage.objects;
create policy "trip image update for editors"
on storage.objects for update to authenticated
using (
  bucket_id = 'trip-images'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
)
with check (
  bucket_id = 'trip-images'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
);

drop policy if exists "trip image delete for editors" on storage.objects;
create policy "trip image delete for editors"
on storage.objects for delete to authenticated
using (
  bucket_id = 'trip-images'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
);
