-- Corrige caminho de criação de viagens no laboratório Neon.
-- O banco do proprietário permanece privado. Não recebe owner_id da interface.
-- Todas as operações usam auth.uid() do JWT previamente validado pela Data API.

create or replace function viaggio_collab.create_trip(p_title text)
returns viaggio_collab.trips
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid;
  bound_owner uuid;
  record_created viaggio_collab.trips%rowtype;
begin
  actor := auth.uid();
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  select po.owner_id into bound_owner
    from viaggio_collab.project_owner po where po.singleton = true;
  if bound_owner is null or bound_owner <> actor then
    raise exception 'PROJECT_OWNER_REQUIRED' using errcode='42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 150 then
    raise exception 'INVALID_TITLE' using errcode='22023';
  end if;
  insert into viaggio_collab.trips(owner_id, title)
    values(actor, btrim(p_title))
    returning * into record_created;
  return record_created;
end;
$$;

create or replace function viaggio_collab.creation_diagnostic()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session_valid', auth.uid() is not null,
    'project_owner_matches_session',
       exists(select 1 from viaggio_collab.project_owner po
              where po.singleton=true and po.owner_id=auth.uid()),
    'authorized_trip_count',
       (select count(*) from viaggio_collab.trips t
        where t.owner_id = auth.uid())
  );
$$;

-- Um token autenticado pode executar RPC de criação apenas após a verificação
-- explícita do vínculo. Bloqueia a inserção direta via REST.
revoke all on function viaggio_collab.create_trip(text) from public;
revoke all on function viaggio_collab.creation_diagnostic() from public;
grant execute on function viaggio_collab.create_trip(text) to authenticated;
grant execute on function viaggio_collab.creation_diagnostic() to authenticated;
revoke insert on viaggio_collab.trips from authenticated;
