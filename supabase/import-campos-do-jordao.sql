-- Importa o roteiro familiar de Campos do Jordão para a viagem de 20 a 24/07/2026.
-- Execute este arquivo uma vez no Supabase SQL Editor.
-- A operação é atômica e idempotente: em caso de erro, nada é alterado;
-- se executada novamente, recria somente a agenda desses cinco dias.

do $$
declare
  trip_id_var uuid;
  matching_trips integer;
  matching_days integer;
begin
  select count(*)
    into matching_trips
  from public.trips
  where deleted_at is null
    and start_date = date '2026-07-20'
    and end_date = date '2026-07-24'
    and (
      lower(name) like '%campos do jordão%'
      or lower(name) like '%campos do jordao%'
      or lower(destination) like '%campos do jordão%'
      or lower(destination) like '%campos do jordao%'
    );

  if matching_trips = 0 then
    raise exception 'Viagem Campos do Jordão (20–24/07/2026) não encontrada.';
  elsif matching_trips > 1 then
    raise exception 'Mais de uma viagem Campos do Jordão foi encontrada. A importação foi cancelada.';
  end if;

  select id into trip_id_var
  from public.trips
  where deleted_at is null
    and start_date = date '2026-07-20'
    and end_date = date '2026-07-24'
    and (
      lower(name) like '%campos do jordão%'
      or lower(name) like '%campos do jordao%'
      or lower(destination) like '%campos do jordão%'
      or lower(destination) like '%campos do jordao%'
    )
  limit 1;

  select count(*) into matching_days
  from public.trip_days
  where trip_id = trip_id_var
    and date between date '2026-07-20' and date '2026-07-24';

  if matching_days <> 5 then
    raise exception 'A viagem precisa possuir exatamente os cinco dias de 20 a 24/07/2026.';
  end if;

  update public.trip_days
  set title = case date
      when date '2026-07-20' then 'Chegada e primeira noite em Capivari'
      when date '2026-07-21' then 'Amantikir e Museu Felícia Leirner'
      when date '2026-07-22' then 'Hotel, Ducha de Prata e Capivari'
      when date '2026-07-23' then 'Horto Florestal e noite de fondue'
      when date '2026-07-24' then 'Última manhã em Campos do Jordão'
    end,
    summary = case date
      when date '2026-07-20' then 'Check-in no Golden Park, lazer no hotel, Capivari, chocolate quente e hambúrguer. Opções: Manhattan Burger ou Mad Maria Burguer.'
      when date '2026-07-21' then 'Café da manhã no hotel, Parque Amantikir, almoço econômico, Museu Felícia Leirner, Auditório Cláudio Santoro e retorno ao hotel.'
      when date '2026-07-22' then 'Manhã inteira no hotel, Ducha de Prata, Capivari, chocolate quente e jantar. Opções: Levare Pizzaria ou La Fortezza.'
      when date '2026-07-23' then 'Café da manhã, Horto Florestal, almoço simples, descanso no hotel, fondue e caminhada pelo Capivari iluminado.'
      when date '2026-07-24' then 'Café da manhã, últimas atividades no hotel, check-out e possível parada no Portal para chocolates e lembranças.'
    end,
    status = 'planned'
  where trip_id = trip_id_var
    and date between date '2026-07-20' and date '2026-07-24';

  -- O arquivo representa o roteiro completo; somente a agenda destes cinco dias é substituída.
  delete from public.activities
  where day_id in (
    select id from public.trip_days
    where trip_id = trip_id_var
      and date between date '2026-07-20' and date '2026-07-24'
  );

  insert into public.activities
    (day_id, period, position, title, description, starts_at, place_name)
  select
    d.id,
    v.period,
    v.position,
    v.title,
    v.description,
    v.starts_at,
    v.place_name
  from (values
    (date '2026-07-20', 'afternoon', 0, 'Check-in e descanso', 'Chegada, check-in e tempo para descansar.', timestamptz '2026-07-20 15:30:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-20', 'afternoon', 1, 'Piscina aquecida e salão de jogos', 'Fim de tarde de lazer no hotel.', timestamptz '2026-07-20 17:30:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-20', 'night', 2, 'Passeio por Capivari e chocolate quente', 'Primeiro passeio pelo centro turístico.', timestamptz '2026-07-20 19:30:00+00', 'Capivari'),
    (date '2026-07-20', 'night', 3, 'Hambúrguer', 'Manhattan Burger ou Mad Maria Burguer.', timestamptz '2026-07-20 20:30:00+00', 'Capivari'),

    (date '2026-07-21', 'morning', 0, 'Café da manhã no hotel', null, timestamptz '2026-07-21 08:00:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-21', 'morning', 1, 'Parque Amantikir', null, timestamptz '2026-07-21 09:30:00+00', 'Parque Amantikir'),
    (date '2026-07-21', 'afternoon', 2, 'Almoço econômico', 'Ceza''s Restaurante ou Bom Petisco.', timestamptz '2026-07-21 13:00:00+00', 'Campos do Jordão'),
    (date '2026-07-21', 'afternoon', 3, 'Museu Felícia Leirner e Auditório Cláudio Santoro', null, timestamptz '2026-07-21 15:30:00+00', 'Museu Felícia Leirner'),
    (date '2026-07-21', 'night', 4, 'Retorno ao hotel e piscina aquecida', null, timestamptz '2026-07-21 18:30:00+00', 'Golden Park Campos do Jordão'),

    (date '2026-07-22', 'morning', 0, 'Manhã inteira no hotel', 'Piscina aquecida, fazendinha, pedalinho, salão de jogos e trilha leve.', timestamptz '2026-07-22 09:00:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-22', 'afternoon', 1, 'Ducha de Prata', null, timestamptz '2026-07-22 14:30:00+00', 'Ducha de Prata'),
    (date '2026-07-22', 'afternoon', 2, 'Capivari e chocolate quente', null, timestamptz '2026-07-22 17:00:00+00', 'Capivari'),
    (date '2026-07-22', 'night', 3, 'Jantar de pizza', 'Levare Pizzaria ou La Fortezza.', timestamptz '2026-07-22 19:30:00+00', 'Capivari'),

    (date '2026-07-23', 'morning', 0, 'Café da manhã', null, timestamptz '2026-07-23 08:00:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-23', 'morning', 1, 'Horto Florestal', null, timestamptz '2026-07-23 09:30:00+00', 'Parque Estadual Campos do Jordão — Horto Florestal'),
    (date '2026-07-23', 'afternoon', 2, 'Almoço simples', null, timestamptz '2026-07-23 13:00:00+00', 'Campos do Jordão'),
    (date '2026-07-23', 'afternoon', 3, 'Descanso no hotel', null, timestamptz '2026-07-23 15:00:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-23', 'night', 4, 'Noite especial de fondue', null, timestamptz '2026-07-23 19:30:00+00', 'Capivari'),
    (date '2026-07-23', 'night', 5, 'Caminhada pelo Capivari iluminado', null, timestamptz '2026-07-23 21:00:00+00', 'Capivari'),

    (date '2026-07-24', 'morning', 0, 'Café da manhã', null, timestamptz '2026-07-24 08:00:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-24', 'morning', 1, 'Aproveitar o hotel', null, timestamptz '2026-07-24 09:00:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-24', 'afternoon', 2, 'Check-out', null, timestamptz '2026-07-24 12:00:00+00', 'Golden Park Campos do Jordão'),
    (date '2026-07-24', 'afternoon', 3, 'Portal: chocolates e lembranças', 'Parada opcional, se houver tempo.', timestamptz '2026-07-24 12:30:00+00', 'Portal de Campos do Jordão')
  ) as v(day_date, period, position, title, description, starts_at, place_name)
  join public.trip_days d
    on d.trip_id = trip_id_var
   and d.date = v.day_date;
end $$;
