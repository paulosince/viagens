-- Private day attachments. Storage paths: trip_id/day_id/random-id.extension.
create table if not exists public.day_attachments (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.trip_days(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 6291456),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists day_attachments_day_created_idx
  on public.day_attachments (day_id, created_at, id);

alter table public.day_attachments enable row level security;
revoke all on public.day_attachments from public, anon;
grant select, insert, delete on public.day_attachments to authenticated;

create policy "day attachments read for members" on public.day_attachments
  for select to authenticated using (
    exists (select 1 from public.trip_days d
      where d.id = day_id and public.is_trip_member(d.trip_id))
  );

create policy "day attachments insert for editors" on public.day_attachments
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.trip_days d
      where d.id = day_id
        and split_part(storage_path, '/', 1) = d.trip_id::text
        and split_part(storage_path, '/', 2) = d.id::text
        and public.is_trip_member(d.trip_id, 'editor'))
  );

create policy "day attachments delete for editors" on public.day_attachments
  for delete to authenticated using (
    exists (select 1 from public.trip_days d
      where d.id = day_id and public.is_trip_member(d.trip_id, 'editor'))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('day-attachments', 'day-attachments', false, 6291456,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif',
        'application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy "day attachment object read for members" on storage.objects
  for select to authenticated using (
    bucket_id = 'day-attachments'
    and exists (select 1 from public.trip_days d
      where d.id::text = (storage.foldername(name))[2]
        and d.trip_id::text = (storage.foldername(name))[1]
        and public.is_trip_member(d.trip_id))
  );

create policy "day attachment object insert for editors" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'day-attachments'
    and exists (select 1 from public.trip_days d
      where d.id::text = (storage.foldername(name))[2]
        and d.trip_id::text = (storage.foldername(name))[1]
        and public.is_trip_member(d.trip_id, 'editor'))
  );

create policy "day attachment object delete for editors" on storage.objects
  for delete to authenticated using (
    bucket_id = 'day-attachments'
    and exists (select 1 from public.trip_days d
      where d.id::text = (storage.foldername(name))[2]
        and d.trip_id::text = (storage.foldername(name))[1]
        and public.is_trip_member(d.trip_id, 'editor'))
  );
