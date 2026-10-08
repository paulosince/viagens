drop policy if exists "trip image read for members" on storage.objects;
create policy "trip image read for members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trip-images'
  and exists (
    select 1
    from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and public.is_trip_member(t.id)
  )
);

drop policy if exists "trip image insert for editors" on storage.objects;
create policy "trip image insert for editors"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-images'
  and exists (
    select 1
    from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
);

drop policy if exists "trip image update for editors" on storage.objects;
create policy "trip image update for editors"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-images'
  and exists (
    select 1
    from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
)
with check (
  bucket_id = 'trip-images'
  and exists (
    select 1
    from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
);

drop policy if exists "trip image delete for editors" on storage.objects;
create policy "trip image delete for editors"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-images'
  and exists (
    select 1
    from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and public.is_trip_member(t.id, 'editor')
  )
);
