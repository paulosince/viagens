-- Every attachment belongs to a trip; linking it to a day is optional.
alter table public.day_attachments
  add column if not exists trip_id uuid references public.trips(id) on delete cascade;

update public.day_attachments a
set trip_id = d.trip_id
from public.trip_days d
where a.day_id = d.id and a.trip_id is null;

alter table public.day_attachments
  alter column trip_id set not null,
  alter column day_id drop not null;

-- Older installed PWAs still send only day_id until their service worker updates.
create or replace function public.fill_attachment_trip_id()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.trip_id is null and new.day_id is not null then
    select d.trip_id into new.trip_id from public.trip_days d where d.id = new.day_id;
  end if;
  return new;
end;
$$;

revoke all on function public.fill_attachment_trip_id() from public, anon;
grant execute on function public.fill_attachment_trip_id() to authenticated;

create trigger fill_attachment_trip_id_before_insert
  before insert on public.day_attachments
  for each row execute function public.fill_attachment_trip_id();

create index if not exists day_attachments_trip_created_idx
  on public.day_attachments (trip_id, created_at, id);

drop policy if exists "day attachments read for members" on public.day_attachments;
create policy "day attachments read for members" on public.day_attachments
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "day attachments insert for editors" on public.day_attachments;
create policy "day attachments insert for editors" on public.day_attachments
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and public.is_trip_member(trip_id, 'editor')
    and split_part(storage_path, '/', 1) = trip_id::text
    and (
      (day_id is null and split_part(storage_path, '/', 2) = 'general')
      or exists (
        select 1 from public.trip_days d
        where d.id = day_id and d.trip_id = day_attachments.trip_id
          and split_part(storage_path, '/', 2) = d.id::text
      )
    )
  );

drop policy if exists "day attachments delete for editors" on public.day_attachments;
create policy "day attachments delete for editors" on public.day_attachments
  for delete to authenticated using (public.is_trip_member(trip_id, 'editor'));

drop policy if exists "day attachment object read for members" on storage.objects;
create policy "day attachment object read for members" on storage.objects
  for select to authenticated using (
    bucket_id = 'day-attachments'
    and exists (
      select 1 from public.trips t
      where t.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_trip_member(t.id)
        and (
          (storage.foldername(storage.objects.name))[2] = 'general'
          or exists (
            select 1 from public.trip_days d
            where d.trip_id = t.id and d.id::text = (storage.foldername(storage.objects.name))[2]
          )
        )
    )
  );

drop policy if exists "day attachment object insert for editors" on storage.objects;
create policy "day attachment object insert for editors" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'day-attachments'
    and exists (
      select 1 from public.trips t
      where t.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_trip_member(t.id, 'editor')
        and (
          (storage.foldername(storage.objects.name))[2] = 'general'
          or exists (
            select 1 from public.trip_days d
            where d.trip_id = t.id and d.id::text = (storage.foldername(storage.objects.name))[2]
          )
        )
    )
  );

drop policy if exists "day attachment object delete for editors" on storage.objects;
create policy "day attachment object delete for editors" on storage.objects
  for delete to authenticated using (
    bucket_id = 'day-attachments'
    and exists (
      select 1 from public.trips t
      where t.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_trip_member(t.id, 'editor')
        and (
          (storage.foldername(storage.objects.name))[2] = 'general'
          or exists (
            select 1 from public.trip_days d
            where d.trip_id = t.id and d.id::text = (storage.foldername(storage.objects.name))[2]
          )
        )
    )
  );
