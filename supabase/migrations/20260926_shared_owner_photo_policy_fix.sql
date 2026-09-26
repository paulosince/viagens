-- Qualify the outer storage object name; unqualified name resolves to trips.name.
drop policy if exists "profile photo read shared trip owner" on storage.objects;
create policy "profile photo read shared trip owner" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and exists (
    select 1 from public.trips t
      where t.user_id::text = (storage.foldername(storage.objects.name))[1]
        and t.deleted_at is null and public.is_trip_member(t.id)
  ));
