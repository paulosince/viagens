-- Viaggio / Neon: quota segura para upload mediado por servidor (laboratório)
-- Não substitui a versão v1. Nunca aceitar upload direto de browser para bucket.
-- O servidor autentica o usuário, gera a chave 'uploads/<uuid>', reserva
-- bytes, faz PUT no bucket privado, verifica HEAD e só então confirma.
-- Se falhar, NÃO libere a reserva até verificar a ausência física do objeto.
-- A função não é exposta na Data API; papel do navegador não recebe grants.

create table if not exists viaggio_lab.v2_storage_budget (
 singleton smallint primary key default 1 check(singleton=1),
 allowance_bytes bigint not null default 4000000000 check(allowance_bytes>0),
 reserved_bytes bigint not null default 0 check(reserved_bytes>=0),
 committed_bytes bigint not null default 0 check(committed_bytes>=0),
 constraint v2_quota_enforced check(reserved_bytes + committed_bytes <= allowance_bytes)
);
insert into viaggio_lab.v2_storage_budget(singleton) values(1)
 on conflict(singleton) do nothing;

create table if not exists viaggio_lab.v2_upload_ledger (
 upload_id uuid primary key,
 object_key text not null unique,
 declared_bytes bigint not null check(declared_bytes>0 and declared_bytes<=25000000),
 verified_bytes bigint check(verified_bytes>=0),
 state text not null default 'reserved'
   check(state in ('reserved','committed','reclaimed')),
 created_at timestamptz not null default now(),
 finalized_at timestamptz,
 check ((state='committed' and verified_bytes=declared_bytes) or state<>'committed')
);

create or replace function viaggio_lab.v2_reserve_upload(
 p_id uuid, p_bytes bigint
) returns table(object_key text, available_bytes bigint)
language plpgsql set search_path = '' as $$
declare
 b viaggio_lab.v2_storage_budget%rowtype;
 u viaggio_lab.v2_upload_ledger%rowtype;
 k text;
begin
 if p_id is null or p_bytes is null or p_bytes<=0 or p_bytes>25000000 then
   raise exception 'INVALID_UPLOAD_REQUEST';
 end if;
 k := 'uploads/' || p_id::text;
 select * into strict b from viaggio_lab.v2_storage_budget where singleton=1 for update;
 select * into u from viaggio_lab.v2_upload_ledger where upload_id=p_id;
 if found then
   if u.state <> 'reserved' or u.declared_bytes<>p_bytes then
     raise exception 'UPLOAD_ID_CONFLICT';
   end if;
   return query select k, b.allowance_bytes-b.reserved_bytes-b.committed_bytes;
   return;
 end if;
 if p_bytes>b.allowance_bytes-b.reserved_bytes-b.committed_bytes then
   raise exception 'STORAGE_QUOTA_EXCEEDED';
 end if;
 insert into viaggio_lab.v2_upload_ledger(upload_id,object_key,declared_bytes)
 values(p_id,k,p_bytes);
 update viaggio_lab.v2_storage_budget set reserved_bytes=reserved_bytes+p_bytes
 where singleton=1 returning * into b;
 return query select k, b.allowance_bytes-b.reserved_bytes-b.committed_bytes;
end;
$$;

create or replace function viaggio_lab.v2_commit_upload(
 p_id uuid, p_server_verified_bytes bigint
) returns bigint
language plpgsql set search_path = '' as $$
declare
 b viaggio_lab.v2_storage_budget%rowtype;
 u viaggio_lab.v2_upload_ledger%rowtype;
begin
 select * into strict b from viaggio_lab.v2_storage_budget where singleton=1 for update;
 select * into strict u from viaggio_lab.v2_upload_ledger where upload_id=p_id for update;
 if u.state='committed' then
  if u.verified_bytes=p_server_verified_bytes then
   return b.allowance_bytes-b.reserved_bytes-b.committed_bytes;
  end if;
  raise exception 'UPLOAD_COMMIT_CONFLICT';
 end if;
 if u.state<>'reserved' then raise exception 'UPLOAD_RESERVATION_INACTIVE'; end if;
 if u.declared_bytes<>p_server_verified_bytes then raise exception 'UPLOAD_SIZE_MISMATCH'; end if;
 update viaggio_lab.v2_upload_ledger
 set state='committed', verified_bytes=p_server_verified_bytes,finalized_at=clock_timestamp()
 where upload_id=p_id;
 update viaggio_lab.v2_storage_budget
 set reserved_bytes=reserved_bytes-u.declared_bytes,
     committed_bytes=committed_bytes+u.declared_bytes
 where singleton=1 returning * into b;
 return b.allowance_bytes-b.reserved_bytes-b.committed_bytes;
end;
$$;

create or replace function viaggio_lab.v2_reclaim_after_verified_delete(
 p_id uuid
) returns boolean
language plpgsql set search_path = '' as $$
declare
 b viaggio_lab.v2_storage_budget%rowtype;
 u viaggio_lab.v2_upload_ledger%rowtype;
begin
 -- O backend, nunca o cliente, deve confirmar que o objeto NÃO EXISTE
 -- depois de DELETE + HEAD. Falhas de rede mantêm a reserva.
 select * into strict b from viaggio_lab.v2_storage_budget where singleton=1 for update;
 select * into u from viaggio_lab.v2_upload_ledger where upload_id=p_id for update;
 if not found or u.state='reclaimed' then return false; end if;
 if u.state='reserved' then
   update viaggio_lab.v2_storage_budget
   set reserved_bytes=reserved_bytes-u.declared_bytes where singleton=1;
 elsif u.state='committed' then
   update viaggio_lab.v2_storage_budget
   set committed_bytes=committed_bytes-u.verified_bytes where singleton=1;
 end if;
 update viaggio_lab.v2_upload_ledger
 set state='reclaimed',finalized_at=clock_timestamp() where upload_id=p_id;
 return true;
end;
$$;

revoke all on table viaggio_lab.v2_storage_budget from public;
revoke all on table viaggio_lab.v2_upload_ledger from public;
revoke all on function viaggio_lab.v2_reserve_upload(uuid,bigint) from public;
revoke all on function viaggio_lab.v2_commit_upload(uuid,bigint) from public;
revoke all on function viaggio_lab.v2_reclaim_after_verified_delete(uuid) from public;
