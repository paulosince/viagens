-- Enriquece, sem duplicar, a viagem Campos do Jordão de 20 a 24/07/2026.
-- Mantém os IDs das atividades existentes, acrescenta texto editorial, fotos
-- e locais georreferenciados. Pode ser executado novamente com segurança.

alter table public.trip_days add column if not exists main_place_name text;
alter table public.activities add column if not exists address text;
alter table public.activities add column if not exists latitude numeric;
alter table public.activities add column if not exists longitude numeric;
alter table public.activities add column if not exists place_id text;
alter table public.activities add column if not exists photo_url text;
alter table public.day_locations add column if not exists provider text;
alter table public.day_locations add column if not exists provider_place_id text;
alter table public.day_locations add column if not exists formatted_address text;
alter table public.day_locations add column if not exists latitude double precision;
alter table public.day_locations add column if not exists longitude double precision;
alter table public.day_locations add column if not exists category text;
alter table public.day_locations add column if not exists place_type text;
alter table public.day_locations add column if not exists photo_provider text;
alter table public.day_locations add column if not exists photo_author text;
alter table public.day_locations add column if not exists photo_author_url text;
alter table public.day_locations add column if not exists photo_source_url text;

do $$
declare
  trip_id_var uuid;
  matching_trips integer;
  hotel_photo text;
begin
  select count(*)
    into matching_trips
  from public.trips
  where deleted_at is null
    and start_date = date '2026-07-20'
    and end_date = date '2026-07-24'
    and (
      lower(coalesce(name, '') || ' ' || coalesce(destination, '')) like '%campos do jordão%'
      or lower(coalesce(name, '') || ' ' || coalesce(destination, '')) like '%campos do jordao%'
    );

  if matching_trips = 0 then
    raise exception 'Viagem Campos do Jordão (20–24/07/2026) não encontrada.';
  elsif matching_trips > 1 then
    raise exception 'Mais de uma viagem Campos do Jordão foi encontrada. Nada foi alterado.';
  end if;

  select id into trip_id_var
  from public.trips
  where deleted_at is null
    and start_date = date '2026-07-20'
    and end_date = date '2026-07-24'
    and (
      lower(coalesce(name, '') || ' ' || coalesce(destination, '')) like '%campos do jordão%'
      or lower(coalesce(name, '') || ' ' || coalesce(destination, '')) like '%campos do jordao%'
    )
  limit 1;

  if (select count(*) from public.trip_days where trip_id = trip_id_var and date between date '2026-07-20' and date '2026-07-24') <> 5 then
    raise exception 'A viagem precisa possuir exatamente os cinco dias de 20 a 24/07/2026.';
  end if;

  -- Preserva uma eventual foto real do hotel já escolhida pela família.
  select a.photo_url into hotel_photo
  from public.activities a
  join public.trip_days d on d.id = a.day_id
  where d.trip_id = trip_id_var
    and a.place_name ilike '%Golden Park%'
    and a.photo_url is not null
  limit 1;

  hotel_photo := coalesce(
    hotel_photo,
    'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1600&q=82'
  );

  update public.trip_days
  set
    title = v.title,
    summary = v.summary,
    main_place_name = v.main_place_name,
    photo_url = v.photo_url,
    status = 'planned'
  from (values
    (date '2026-07-20', 'Chegada, hotel e primeira noite em Capivari', 'A viagem começa com o ritmo certo: instalar-se no Golden Park, aproveitar a piscina aquecida e terminar a noite entre as luzes, os chocolates e os sabores de Capivari.', 'Hotel Golden Park', hotel_photo),
    (date '2026-07-21', 'Jardins, arte e paisagem da Mantiqueira', 'Um dia de cores e formas: os jardins do Amantikir pela manhã e, depois do almoço, as esculturas a céu aberto do Museu Felícia Leirner junto à arquitetura do Auditório Claudio Santoro.', 'Parque Amantikir', 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_do_Parque_Amantikir.jpg?width=1600'),
    (date '2026-07-22', 'Um dia leve entre água, hotel e Capivari', 'A manhã pertence ao hotel. À tarde, a Ducha de Prata oferece água, madeira e mata em um passeio curto; Capivari fecha o dia com chocolate quente e pizza.', 'Hotel Golden Park', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ducha_de_Prata%2C_Campos_do_Jord%C3%A3o.jpg?width=1600'),
    (date '2026-07-23', 'Araucárias, descanso e fondue', 'O Horto Florestal é o grande cenário do dia: riachos, araucárias e trilhas possíveis para a família. Depois vem uma pausa no hotel e uma noite de fondue em Capivari.', 'Parque Estadual de Campos do Jordão — Horto Florestal', 'https://commons.wikimedia.org/wiki/Special:FilePath/Horto_Florestal_de_Campos_do_Jord%C3%A3o_03.jpg?width=1600'),
    (date '2026-07-24', 'Despedida sem pressa', 'O último dia ainda é parte da viagem: café da manhã, uma volta final pelo hotel e, se houver tempo, uma fotografia no Portal antes da estrada de volta.', 'Hotel Golden Park', 'https://commons.wikimedia.org/wiki/Special:FilePath/Campos_do_Jord%C3%A3o%2C_o_Portal.jpg?width=1600')
  ) as v(day_date, title, summary, main_place_name, photo_url)
  where trip_days.trip_id = trip_id_var
    and trip_days.date = v.day_date;

  update public.activities a
  set
    title = v.title,
    description = v.description,
    place_name = v.place_name,
    address = v.address,
    latitude = v.latitude,
    longitude = v.longitude,
    photo_url = v.photo_url
  from public.trip_days d
  join (values
    (date '2026-07-20', 0, 'Chegada e check-in no Golden Park', 'Chegamos ao Golden Park, quase na porta de entrada de Campos do Jordão. É hora de guardar as malas, reconhecer os chalés e deixar o frio da serra anunciar que a viagem começou. Sem pressa: o hotel também é parte do passeio.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-20', 1, 'Piscina aquecida e salão de jogos', 'Depois do quarto, o hotel vira destino. A piscina aquecida ajuda a desacelerar da estrada; o salão de jogos abre espaço para a primeira disputa da viagem. Separem roupa seca e casaco para sair confortáveis depois.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-20', 2, 'Capivari, luzes e chocolate quente', 'Vamos até o Parque Capivari, coração turístico da cidade. A arquitetura de inspiração alpina, as vitrines e o movimento noturno criam a clássica atmosfera de Campos do Jordão. Caminhem sem roteiro rígido e escolham um chocolate quente para dividir a chegada com o frio.', 'Parque Capivari', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'https://commons.wikimedia.org/wiki/Special:FilePath/Vila_Capivari%2C_Campos_do_Jord%C3%A3o.JPG?width=1600'),
    (date '2026-07-20', 3, 'Hambúrguer para fechar a primeira noite', 'A primeira noite pede uma refeição simples e animada. Manhattan Burger e Mad Maria Burguer continuam como boas opções na região; escolham pelo movimento e pelo cardápio que agradar mais à família, sem transformar o jantar em compromisso.', 'Parque Capivari', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'https://commons.wikimedia.org/wiki/Special:FilePath/Campos_do_Jord%C3%A3o_%287091453855%29.jpg?width=1600'),

    (date '2026-07-21', 0, 'Café da manhã com tempo', 'Comecem pelo café do hotel, sem correr. Pães, frutas e algo quente ajudam antes de uma manhã inteira ao ar livre. Vale levar água e deixar os casacos fáceis de alcançar: a temperatura muda bastante entre sol e sombra.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-21', 1, 'Parque Amantikir', 'Amantikir reúne jardins inspirados em diferentes partes do mundo, unidos pelas montanhas da Mantiqueira. O labirinto verde, os lagos, os caminhos geométricos e a casa da árvore fazem a visita funcionar para adultos e crianças. Reservem cerca de duas horas e não tentem fotografar tudo: algumas cenas merecem apenas ser vividas.', 'Parque Amantikir', 'Rua Simplício de Toledo Neto, 2200 — Gavião Gonzaga, Campos do Jordão, SP', -22.7831400, -45.6075600, 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_do_Parque_Amantikir.jpg?width=1600'),
    (date '2026-07-21', 2, 'Almoço gostoso e sem cerimônia', 'A pausa será na região urbana de Abernéssia, onde Campos do Jordão volta a ter ritmo de cidade vivida, não apenas de destino turístico. Ceza''s e Bom Petisco permanecem como alternativas econômicas. A missão aqui é simples: comer bem, descansar as pernas e seguir para a arte.', 'Abernéssia', 'Abernéssia — Campos do Jordão, SP', -22.7391000, -45.5919000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Campos_do_Jord%C3%A3o_%287091453855%29.jpg?width=1600'),
    (date '2026-07-21', 3, 'Museu Felícia Leirner e Auditório Claudio Santoro', 'Este é um museu para caminhar dentro da paisagem. As esculturas de Felícia Leirner aparecem entre gramados, árvores e horizontes da Mantiqueira; ao lado, o Auditório Claudio Santoro conecta o lugar à história do Festival de Inverno. Observem como arte, arquitetura e natureza mudam conforme o caminho.', 'Museu Felícia Leirner e Auditório Claudio Santoro', 'Avenida Dr. Luís Arrobas Martins, 1880 — Alto da Boa Vista, Campos do Jordão, SP', -22.7433100, -45.6341000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Por_do_Sol_no_Museu_Felicia_Leirner.jpg?width=1600'),
    (date '2026-07-21', 4, 'Volta ao hotel e piscina aquecida', 'Depois de jardins e esculturas, a melhor continuação é não acrescentar outra obrigação. Voltem ao hotel, troquem de roupa e deixem a piscina aquecida encerrar o dia. Quem preferir pode ficar no salão de jogos ou simplesmente descansar.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),

    (date '2026-07-22', 0, 'Uma manhã inteira para viver o hotel', 'Hoje não há motivo para sair cedo. Piscina aquecida, fazendinha, pedalinho, salão de jogos e uma trilha leve transformam a hospedagem em programa. Cada pessoa pode escolher seu ritmo; o objetivo é que a manhã pareça férias, não intervalo entre atrações.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-22', 1, 'Ducha de Prata', 'A Ducha de Prata conduz a água da montanha por canaletas até pequenas quedas cercadas de vegetação. As passarelas de madeira aproximam a família da água sem exigir uma trilha longa. Aproveitem os ângulos das pontes e deixem as lojinhas para o fim, evitando carregar sacolas durante o passeio.', 'Ducha de Prata', 'Avenida Mariane Baungart, 2485 — Vila Izabel, Campos do Jordão, SP', -22.7379544, -45.5694055, 'https://commons.wikimedia.org/wiki/Special:FilePath/Ducha_de_Prata%2C_Campos_do_Jord%C3%A3o.jpg?width=1600'),
    (date '2026-07-22', 2, 'Fim de tarde em Capivari', 'De volta a Capivari, a proposta é observar a vila mudar com o cair da luz. As fachadas acendem, o frio aumenta e as mesas começam a encher. Este é um bom momento para experimentar outro chocolate quente ou apenas passear pelas ruas ao redor do parque.', 'Parque Capivari', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_%C3%A1rea_da_Vila_Capivari%2C_Campos_do_Jord%C3%A3o.jpg?width=1600'),
    (date '2026-07-22', 3, 'Noite de pizza', 'Levare Pizzaria e La Fortezza seguem como as duas candidatas da noite. Escolham a que estiver mais confortável para o grupo e façam uma refeição longa, daquelas em que a conversa é tão importante quanto a pizza. Amanhã haverá natureza; hoje a noite pode terminar devagar.', 'Parque Capivari', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'https://commons.wikimedia.org/wiki/Special:FilePath/Vila_Capivari%2C_Campos_do_Jord%C3%A3o.JPG?width=1600'),

    (date '2026-07-23', 0, 'Café da manhã antes da floresta', 'O Horto pede energia, mas não pressa. Tomem um café da manhã completo e levem água, tênis confortável e camadas de roupa. A manhã começa fria, porém o corpo aquece rapidamente quando a caminhada entra na mata.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-23', 1, 'Horto Florestal: araucárias, rios e trilhas', 'O Parque Estadual de Campos do Jordão protege um grande trecho da Mantiqueira e deixa a paisagem contar a história do lugar. Araucárias, rios e campos de altitude acompanham os caminhos. Para a família, a Trilha das Três Pontes é uma boa referência: curta, tranquila e com pontes sobre o Rio Sapucaí.', 'Parque Estadual de Campos do Jordão — Horto Florestal', 'Avenida Pedro Paulo, s/n — Horto Florestal, Campos do Jordão, SP', -22.6899500, -45.4895800, 'https://commons.wikimedia.org/wiki/Special:FilePath/Horto_Florestal_de_Campos_do_Jord%C3%A3o_03.jpg?width=1600'),
    (date '2026-07-23', 2, 'Almoço dentro do ritmo do Horto', 'Em vez de interromper o dia com outro deslocamento, façam uma refeição simples na área do parque ou usem a estrutura disponível para uma pausa. O importante é sentar, aquecer-se e comentar o caminho antes de voltar para a cidade.', 'Parque Estadual de Campos do Jordão — Horto Florestal', 'Avenida Pedro Paulo, s/n — Horto Florestal, Campos do Jordão, SP', -22.6899500, -45.4895800, 'https://commons.wikimedia.org/wiki/Special:FilePath/Horto_Florestal_-_Parque_Estadual_de_Campos_do_Jord%C3%A3o.jpg?width=1600'),
    (date '2026-07-23', 3, 'Pausa merecida no hotel', 'A tarde volta a ficar silenciosa. Banho quente, descanso no quarto e nenhuma tarefa adicional: essa pausa protege a energia da família para a noite especial que vem depois.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-23', 4, 'Noite especial de fondue', 'O fondue é menos uma obrigação turística e mais um ritual perfeito para o frio: a mesa fica no centro e ninguém precisa ter pressa. Escolham em Capivari uma casa que agrade à família e considerem uma sequência salgada e doce para transformar o jantar no acontecimento da noite.', 'Parque Capivari', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'https://commons.wikimedia.org/wiki/Special:FilePath/Campos_do_Jord%C3%A3o_%287091453855%29.jpg?width=1600'),
    (date '2026-07-23', 5, 'Capivari iluminado, sem destino certo', 'Depois do fondue, caminhem apenas o quanto estiver agradável. As fachadas, as luzes do parque e o movimento das ruas fazem Capivari parecer outro lugar à noite. Uma última fotografia em família fecha o dia melhor do que qualquer compromisso extra.', 'Parque Capivari', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'https://commons.wikimedia.org/wiki/Special:FilePath/Telef%C3%A9rico_de_Campos_do_Jord%C3%A3o_%283842053805%29.jpg?width=1600'),

    (date '2026-07-24', 0, 'Último café da manhã na serra', 'O último café merece a mesma calma do primeiro. Relembrem o passeio preferido de cada pessoa e confiram a bagagem sem transformar a manhã em contagem regressiva para ir embora.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-24', 1, 'Uma volta final pelo hotel', 'Ainda há tempo para repetir a piscina, o pedalinho, a fazendinha ou o salão de jogos. Em vez de tentar encaixar outra atração, aproveitem o que ficou com vontade de fazer mais uma vez.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-24', 2, 'Check-out e estrada', 'Quartos conferidos, malas no carro e lembranças guardadas. Façam o check-out com margem para resolver qualquer detalhe e sair sem a sensação de atraso.', 'Hotel Golden Park', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, hotel_photo),
    (date '2026-07-24', 3, 'Portal: a última fotografia da viagem', 'Se o horário permitir, parem no Portal de Campos do Jordão. A construção de inspiração alpina marca a passagem entre a cidade e a estrada; é o lugar natural para a foto de despedida. Chocolates e lembranças podem entrar aqui, mas apenas se a parada continuar leve.', 'Portal de Campos do Jordão', 'Rodovia Floriano Rodrigues Pinheiro — Vila Nair, Campos do Jordão, SP', -22.7550789, -45.6097917, 'https://commons.wikimedia.org/wiki/Special:FilePath/Campos_do_Jord%C3%A3o%2C_o_Portal.jpg?width=1600')
  ) as v(day_date, position, title, description, place_name, address, latitude, longitude, photo_url)
    on d.date = v.day_date
  where d.trip_id = trip_id_var
    and a.day_id = d.id
    and a.position = v.position;

  delete from public.day_locations
  where day_id in (
    select id from public.trip_days
    where trip_id = trip_id_var
      and date between date '2026-07-20' and date '2026-07-24'
  );

  insert into public.day_locations
    (day_id, position, name, photo_url, provider, provider_place_id, formatted_address, latitude, longitude, category, place_type, photo_provider, photo_author, photo_author_url, photo_source_url)
  select d.id, v.position, v.name, v.photo_url, 'osm', v.osm_id, v.address, v.latitude, v.longitude, v.category, v.place_type, v.photo_provider, v.photo_author, v.photo_author_url, v.photo_source_url
  from (values
    (date '2026-07-20', 0, 'Hotel Golden Park', hotel_photo, 'N13018536970', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, 'tourism', 'hotel', null, null, null, null),
    (date '2026-07-20', 1, 'Parque Capivari', 'https://commons.wikimedia.org/wiki/Special:FilePath/Vila_Capivari%2C_Campos_do_Jord%C3%A3o.JPG?width=1600', 'N951500586', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'tourism', 'park', 'wikimedia', 'Majtec', 'https://commons.wikimedia.org/wiki/User:Majtec', 'https://commons.wikimedia.org/wiki/File:Vila_Capivari,_Campos_do_Jord%C3%A3o.JPG'),

    (date '2026-07-21', 0, 'Hotel Golden Park', hotel_photo, 'N13018536970', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, 'tourism', 'hotel', null, null, null, null),
    (date '2026-07-21', 1, 'Parque Amantikir', 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_do_Parque_Amantikir.jpg?width=1600', 'N4677415389', 'Rua Simplício de Toledo Neto, 2200 — Gavião Gonzaga, Campos do Jordão, SP', -22.7831400, -45.6075600, 'tourism', 'garden', 'wikimedia', 'Allice Hunter', 'https://commons.wikimedia.org/wiki/User:Allice_Hunter', 'https://commons.wikimedia.org/wiki/File:Vista_do_Parque_Amantikir.jpg'),
    (date '2026-07-21', 2, 'Abernéssia', 'https://commons.wikimedia.org/wiki/Special:FilePath/Campos_do_Jord%C3%A3o_%287091453855%29.jpg?width=1600', null, 'Abernéssia — Campos do Jordão, SP', -22.7391000, -45.5919000, 'place', 'neighbourhood', 'wikimedia', 'lubasi', 'https://commons.wikimedia.org/wiki/User:Lubasi', 'https://commons.wikimedia.org/wiki/File:Campos_do_Jord%C3%A3o_(7091453855).jpg'),
    (date '2026-07-21', 3, 'Museu Felícia Leirner e Auditório Claudio Santoro', 'https://commons.wikimedia.org/wiki/Special:FilePath/Por_do_Sol_no_Museu_Felicia_Leirner.jpg?width=1600', 'W396091231', 'Avenida Dr. Luís Arrobas Martins, 1880 — Alto da Boa Vista, Campos do Jordão, SP', -22.7433100, -45.6341000, 'tourism', 'museum', 'wikimedia', 'Daniel Gravina Gomes Santiago', 'https://commons.wikimedia.org/wiki/User:Danielgravina', 'https://commons.wikimedia.org/wiki/File:Por_do_Sol_no_Museu_Felicia_Leirner.jpg'),

    (date '2026-07-22', 0, 'Hotel Golden Park', hotel_photo, 'N13018536970', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, 'tourism', 'hotel', null, null, null, null),
    (date '2026-07-22', 1, 'Ducha de Prata', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ducha_de_Prata%2C_Campos_do_Jord%C3%A3o.jpg?width=1600', 'W396448604', 'Avenida Mariane Baungart, 2485 — Vila Izabel, Campos do Jordão, SP', -22.7379544, -45.5694055, 'tourism', 'attraction', 'wikimedia', 'Allice Hunter', 'https://commons.wikimedia.org/wiki/User:Allice_Hunter', 'https://commons.wikimedia.org/wiki/File:Ducha_de_Prata,_Campos_do_Jord%C3%A3o.jpg'),
    (date '2026-07-22', 2, 'Parque Capivari', 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_%C3%A1rea_da_Vila_Capivari%2C_Campos_do_Jord%C3%A3o.jpg?width=1600', 'N951500586', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'tourism', 'park', 'wikimedia', 'Governo do Estado de São Paulo', 'https://commons.wikimedia.org', 'https://commons.wikimedia.org/wiki/File:Vista_%C3%A1rea_da_Vila_Capivari,_Campos_do_Jord%C3%A3o.jpg'),

    (date '2026-07-23', 0, 'Hotel Golden Park', hotel_photo, 'N13018536970', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, 'tourism', 'hotel', null, null, null, null),
    (date '2026-07-23', 1, 'Parque Estadual de Campos do Jordão — Horto Florestal', 'https://commons.wikimedia.org/wiki/Special:FilePath/Horto_Florestal_de_Campos_do_Jord%C3%A3o_03.jpg?width=1600', 'N6949996709', 'Avenida Pedro Paulo, s/n — Horto Florestal, Campos do Jordão, SP', -22.6899500, -45.4895800, 'tourism', 'nature_reserve', 'wikimedia', 'Rafael Borges Mundim', 'https://commons.wikimedia.org/wiki/User:RBmundim', 'https://commons.wikimedia.org/wiki/File:Horto_Florestal_de_Campos_do_Jord%C3%A3o_03.jpg'),
    (date '2026-07-23', 2, 'Parque Capivari', 'https://commons.wikimedia.org/wiki/Special:FilePath/Telef%C3%A9rico_de_Campos_do_Jord%C3%A3o_%283842053805%29.jpg?width=1600', 'N951500586', 'Rua Engenheiro Diogo José de Carvalho, 1291 — Capivari, Campos do Jordão, SP', -22.7176561, -45.5653914, 'tourism', 'park', 'wikimedia', 'Rodrigo Soldon', 'https://commons.wikimedia.org/wiki/User:Rodrigo_Soldon', 'https://commons.wikimedia.org/wiki/File:Telef%C3%A9rico_de_Campos_do_Jord%C3%A3o_(3842053805).jpg'),

    (date '2026-07-24', 0, 'Hotel Golden Park', hotel_photo, 'N13018536970', 'Rodovia Floriano Rodrigues Pinheiro, 2000 — Campos do Jordão, SP', -22.7603502, -45.6116397, 'tourism', 'hotel', null, null, null, null),
    (date '2026-07-24', 1, 'Portal de Campos do Jordão', 'https://commons.wikimedia.org/wiki/Special:FilePath/Campos_do_Jord%C3%A3o%2C_o_Portal.jpg?width=1600', 'W528706434', 'Rodovia Floriano Rodrigues Pinheiro — Vila Nair, Campos do Jordão, SP', -22.7550789, -45.6097917, 'tourism', 'attraction', 'wikimedia', 'Marco Ankosqui / MTur', 'https://commons.wikimedia.org', 'https://commons.wikimedia.org/wiki/File:Campos_do_Jord%C3%A3o,_o_Portal.jpg')
  ) as v(day_date, position, name, photo_url, osm_id, address, latitude, longitude, category, place_type, photo_provider, photo_author, photo_author_url, photo_source_url)
  join public.trip_days d
    on d.trip_id = trip_id_var
   and d.date = v.day_date;

  update public.activities a
  set place_id = l.id::text
  from public.day_locations l
  where a.day_id = l.day_id
    and a.day_id in (
      select id from public.trip_days
      where trip_id = trip_id_var
        and date between date '2026-07-20' and date '2026-07-24'
    )
    and a.place_name = l.name;
end $$;

notify pgrst, 'reload schema';

-- Conferência: devem aparecer 5 dias, 23 atividades e 14 locais.
select
  d.day_number,
  d.date,
  d.title,
  count(distinct a.id) as atividades,
  count(distinct l.id) as locais
from public.trips t
join public.trip_days d on d.trip_id = t.id
left join public.activities a on a.day_id = d.id
left join public.day_locations l on l.day_id = d.id
where t.deleted_at is null
  and t.start_date = date '2026-07-20'
  and t.end_date = date '2026-07-24'
  and (
    lower(coalesce(t.name, '') || ' ' || coalesce(t.destination, '')) like '%campos do jordão%'
    or lower(coalesce(t.name, '') || ' ' || coalesce(t.destination, '')) like '%campos do jordao%'
  )
group by d.day_number, d.date, d.title
order by d.day_number;
