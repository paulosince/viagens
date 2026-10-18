-- Viaggio Neon LAB A: diagnóstico da criação com JWT externo do Supabase.
-- Em PostgREST/Neon Data API, os claims de um JWT JÁ VALIDADO pelo gateway
-- são transmitidos no parâmetro transacional request.jwt.claims.
-- Não aceitar ID de usuário recebido no body; só o sub assinado do token.
-- A function é SECURITY DEFINER apenas para ler o vínculo privado ao projeto.
create or replace function viaggio_collab.create_trip(p_title text)
returns viaggio_collab.trips
language plpgsql security definer
set search_path = ''
as $$
declare
  claims jsonb;
  actor_uuid uuid;
  fixed_owner uuid;
  created viaggio_collab.trips%rowtype;
begin
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  if claims is null then
    raise exception 'JWT_CONTEXT_MISSING' using errcode='42501';
  end if;
  if claims->>'role' is distinct from 'authenticated' or
     (claims->>'sub') is null or
     (claims->>'sub') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  actor_uuid := (claims->>'sub')::uuid;
  select owner_id into fixed_owner
    from viaggio_collab.project_owner where singleton = true;
  if fixed_owner is distinct from actor_uuid then
    raise exception 'PROJECT_OWNER_REQUIRED' using errcode='42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 150 then
    raise exception 'INVALID_TITLE' using errcode='22023';
  end if;
  insert into viaggio_collab.trips(owner_id, title)
    values(actor_uuid, btrim(p_title)) returning * into created;
  return created;
end;
$$;
revoke all on function viaggio_collab.create_trip(text) from public;
grant execute on function viaggio_collab.create_trip(text) to authenticated;
