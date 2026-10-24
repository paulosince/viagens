-- Viaggio: presentation metadata for attached tickets/reservations.
-- Additive migration: existing file_name and storage_path remain untouched.
alter table viaggio_app.day_attachments
  add column if not exists display_title text,
  add column if not exists item_category text,
  add column if not exists event_date date,
  add column if not exists event_time time without time zone,
  add column if not exists venue text,
  add column if not exists activity_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='viaggio_app.day_attachments'::regclass
      and conname='day_attachments_category_check'
  ) then
    alter table viaggio_app.day_attachments
      add constraint day_attachments_category_check
      check (item_category is null or item_category in
        ('flight','hotel','restaurant','show','sport','attraction','transport','other'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='viaggio_app.day_attachments'::regclass
      and conname='day_attachments_activity_id_fkey'
  ) then
    alter table viaggio_app.day_attachments
      add constraint day_attachments_activity_id_fkey
      foreign key(activity_id) references viaggio_app.activities(id) on delete set null;
  end if;
end $$;

grant update(display_title,item_category,event_date,event_time,venue,activity_id)
  on viaggio_app.day_attachments to authenticated;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='viaggio_app'
      and tablename='day_attachments' and policyname='day attachments update for editors'
  ) then
    create policy "day attachments update for editors"
    on viaggio_app.day_attachments for update to authenticated
    using (viaggio_app.is_trip_member(trip_id,'editor'))
    with check (
      viaggio_app.is_trip_member(trip_id,'editor')
      and split_part(storage_path,'/',1)=trip_id::text
      and (
        (day_id is null and split_part(storage_path,'/',2)='general')
        or exists (
          select 1 from viaggio_app.trip_days d
          where d.id=day_id and d.trip_id=trip_id
            and split_part(storage_path,'/',2)=d.id::text
        )
      )
      and (
        activity_id is null or exists (
          select 1 from viaggio_app.activities a
          join viaggio_app.trip_days d on d.id=a.day_id
          where a.id=activity_id and d.trip_id=trip_id
        )
      )
    );
  end if;
end $$;