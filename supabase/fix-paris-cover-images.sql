-- Corrige as capas do Book Paris & Lisboa com imagens coerentes com cada dia.
-- As imagens vêm de arquivos identificados no Wikimedia Commons.
-- Execute no Supabase SQL Editor.

do $$
declare
  target_user uuid;
  trip_id_var uuid;
begin
  select id into target_user
    from auth.users
   where lower(email)=lower('cintiapfs@gmail.com')
   limit 1;

  select id into trip_id_var
    from public.trips
   where user_id=target_user
     and name='Paris & Lisboa'
   limit 1;

  if trip_id_var is null then
    raise exception 'Viagem não encontrada para esta conta.';
  end if;

  update public.trip_days
     set photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Castelo_de_S%C3%A3o_Jorge%2C_Lisboa_203.jpg?width=1600'
   where trip_id=trip_id_var and day_number=2;

  update public.trip_days
     set photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Eiffel_Tower_over_the_Pont_de_l%27Alma_Bridge.jpg?width=1600'
   where trip_id=trip_id_var and day_number=3;

  update public.trip_days
     set photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/The_Louvre_Glass_Pyramid%2C_Paris%2C_France_%2853198133274%29.jpg?width=1600'
   where trip_id=trip_id_var and day_number=4;

  update public.trip_days
     set photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Grande_galerie_de_l%27%C3%A9volution_-_Jardin_des_plantes_-_Paris.jpg?width=1600'
   where trip_id=trip_id_var and day_number=5;

  update public.trip_days
     set photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Parc_des_Princes_Paris_Saint_Germain_z_19.jpg?width=1600'
   where trip_id=trip_id_var and day_number=8;

  update public.trip_days
     set photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Pena_National_Palace_-_Sintra_-_Pal%C3%A1cio_Nacional_da_Pena_%2816278733449%29.jpg?width=1600'
   where trip_id=trip_id_var and day_number=11;
end $$;
