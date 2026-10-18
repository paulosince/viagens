-- Replica da função implantada no Supabase em 18/10/2026.
-- Retorna apenas volumes numéricos associados a viagens próprias, perfil e passageiros salvos.
-- Não atribui viagens compartilhadas aos convidados. O tamanho do banco é estimado.

CREATE OR REPLACE FUNCTION public.viaggio_my_usage()
 RETURNS TABLE(database_bytes bigint, storage_bytes bigint, image_bytes bigint, attachment_bytes bigint, owned_trips bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select (select auth.uid()) as uid),
  owned as (
    select t.id from public.trips t where t.user_id = (select uid from me)
  ),
  database_parts(bytes) as (
    select coalesce(sum(pg_catalog.pg_column_size(t)), 0)::bigint from public.trips t where t.user_id = (select uid from me)
    union all select coalesce(sum(pg_catalog.pg_column_size(p)), 0)::bigint from public.passengers p join owned o on o.id = p.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(d)), 0)::bigint from public.trip_days d join owned o on o.id = d.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(a)), 0)::bigint from public.activities a join public.trip_days d on d.id = a.day_id join owned o on o.id = d.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(l)), 0)::bigint from public.day_locations l join public.trip_days d on d.id = l.day_id join owned o on o.id = d.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(c)), 0)::bigint from public.checklist_items c join owned o on o.id = c.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(b)), 0)::bigint from public.budget_items b join owned o on o.id = b.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(a)), 0)::bigint from public.day_attachments a join owned o on o.id = a.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(s) + pg_catalog.pg_column_size(s.state)), 0)::bigint from public.state_snapshots s join owned o on o.id = s.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(c) + coalesce(pg_catalog.pg_column_size(c.before_state),0) + coalesce(pg_catalog.pg_column_size(c.after_state),0)), 0)::bigint from public.change_log c join owned o on o.id = c.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(p.photo_data) + 80), 0)::bigint from public.snapshot_photos p join owned o on o.id = p.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(p)), 0)::bigint from public.passenger_profiles p where p.user_id = (select uid from me)
    union all select coalesce(sum(pg_catalog.pg_column_size(p)), 0)::bigint from public.saved_passengers p where p.owner_id = (select uid from me)
    union all select coalesce(sum(pg_catalog.pg_column_size(m)), 0)::bigint from public.trip_members m join owned o on o.id = m.trip_id
    union all select coalesce(sum(pg_catalog.pg_column_size(i)), 0)::bigint from public.trip_invitations i join owned o on o.id = i.trip_id
  ),
  file_sizes as (
    select o.bucket_id,
           case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end as bytes
      from storage.objects o
     where (
        o.bucket_id in ('trip-images','day-attachments')
        and exists (select 1 from owned t where t.id::text = pg_catalog.split_part(o.name,'/',1))
      ) or (
        o.bucket_id = 'profile-photos'
        and pg_catalog.split_part(o.name,'/',1) = (select uid::text from me)
      )
  )
  select coalesce((select sum(bytes) from database_parts),0)::bigint,
         coalesce((select sum(bytes) from file_sizes),0)::bigint,
         coalesce((select sum(bytes) from file_sizes where bucket_id in ('trip-images','profile-photos')),0)::bigint,
         coalesce((select sum(bytes) from file_sizes where bucket_id = 'day-attachments'),0)::bigint,
         (select count(*) from owned)::bigint
    where (select uid from me) is not null;
$function$


revoke all on function public.viaggio_my_usage() from public;
revoke all on function public.viaggio_my_usage() from anon;
grant execute on function public.viaggio_my_usage() to authenticated;
