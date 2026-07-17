-- Substitua <USER_UUID> pelo UUID da proprietária antes de executar.
-- Remove somente a viagem de teste com nome e datas exatos.

begin;

create temporary table _trip_to_delete on commit drop as
select id
from public.trips
where user_id = '<USER_UUID>'::uuid
  and name = 'Campos do Jordão'
  and start_date = date '2026-07-20'
  and end_date = date '2026-07-24';

delete from public.trip_days
where trip_id in (select id from _trip_to_delete);

delete from public.passengers
where trip_id in (select id from _trip_to_delete);

delete from public.trip_members
where trip_id in (select id from _trip_to_delete);

delete from public.trips
where id in (select id from _trip_to_delete);

commit;
