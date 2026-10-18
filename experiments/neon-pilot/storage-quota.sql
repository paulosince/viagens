
-- Controlador de cota para um único projeto Neon por viajante (laboratório).
-- Somente um servidor autenticado deve invocar estas funções; nunca conceder a roles do navegador.
create table if not exists viaggio_lab.storage_budget (
  singleton smallint primary key default 1 check (singleton = 1),
  allowance_bytes bigint not null default 4000000000 check (allowance_bytes > 0),
  reserved_bytes bigint not null default 0 check (reserved_bytes >= 0),
  committed_bytes bigint not null default 0 check (committed_bytes >= 0),
  check (reserved_bytes + committed_bytes <= allowance_bytes)
);
insert into viaggio_lab.storage_budget (singleton) values (1)
on conflict (singleton) do nothing;

create table if not exists viaggio_lab.upload_ledger (
  upload_id uuid primary key,
  object_key text not null unique,
  declared_bytes bigint not null check (declared_bytes > 0),
  verified_bytes bigint check (verified_bytes >= 0),
  state text not null default 'reserved'
    check (state in ('reserved', 'committed', 'cancelled', 'expired', 'deleted')),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  check ((state = 'committed' and verified_bytes = declared_bytes)
          or (state != 'committed'))
);

create or replace function viaggio_lab.reserve_upload(
  requested_upload uuid, requested_key text, requested_bytes bigint
)
returns table(upload_id uuid, object_key text, remaining_bytes bigint, expires_at timestamptz)
language plpgsql
set search_path = ''
as $$
declare
  b viaggio_lab.storage_budget%rowtype;
  old_upload viaggio_lab.upload_ledger%rowtype;
  released bigint;
  deadline timestamptz;
begin
  if requested_upload is null or length(btrim(requested_key)) < 1
     or requested_bytes is null or requested_bytes <= 0 then
    raise exception 'INVALID_UPLOAD_REQUEST';
  end if;

  select * into strict b from viaggio_lab.storage_budget where singleton = 1 for update;
  with expired as (
    update viaggio_lab.upload_ledger AS expired_upload
      set state='expired'
      where expired_upload.state='reserved' and expired_upload.expires_at <= clock_timestamp()
      returning expired_upload.declared_bytes
  )
  select coalesce(sum(declared_bytes), 0) into released from expired;

  if released > 0 then
    update viaggio_lab.storage_budget
      set reserved_bytes = reserved_bytes - released where singleton = 1
      returning * into b;
  end if;

  select * into old_upload from viaggio_lab.upload_ledger u
    where u.upload_id = requested_upload;

  if found then
    if old_upload.object_key != requested_key
       or old_upload.declared_bytes != requested_bytes
       or old_upload.state != 'reserved' then
      raise exception 'UPLOAD_ID_CONFLICT';
    end if;
    return query select requested_upload, requested_key,
      b.allowance_bytes - b.reserved_bytes - b.committed_bytes,
      old_upload.expires_at;
    return;
  end if;

  if requested_bytes > b.allowance_bytes - b.reserved_bytes - b.committed_bytes then
    raise exception 'STORAGE_QUOTA_EXCEEDED';
  end if;

  deadline := clock_timestamp() + interval '15 minutes';
  insert into viaggio_lab.upload_ledger (upload_id, object_key, declared_bytes, expires_at)
    values (requested_upload, requested_key, requested_bytes, deadline);
  update viaggio_lab.storage_budget
    set reserved_bytes = reserved_bytes + requested_bytes where singleton = 1
    returning * into b;

  return query select requested_upload, requested_key,
    b.allowance_bytes - b.reserved_bytes - b.committed_bytes,
    deadline;
end;
$$;

create or replace function viaggio_lab.commit_upload(
  requested_upload uuid, object_size_verified_by_server bigint
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  b viaggio_lab.storage_budget%rowtype;
  u viaggio_lab.upload_ledger%rowtype;
begin
  select * into strict b from viaggio_lab.storage_budget where singleton = 1 for update;
  select * into strict u from viaggio_lab.upload_ledger
    where upload_id = requested_upload for update;
  if u.state = 'committed' then
    if u.verified_bytes = object_size_verified_by_server then
      return b.allowance_bytes - b.reserved_bytes - b.committed_bytes;
    end if;
    raise exception 'UPLOAD_COMMIT_CONFLICT';
  end if;
  if u.state != 'reserved' or u.expires_at <= clock_timestamp() then
    raise exception 'UPLOAD_RESERVATION_INACTIVE';
  end if;
  if object_size_verified_by_server != u.declared_bytes then
    raise exception 'UPLOAD_SIZE_MISMATCH';
  end if;
  update viaggio_lab.upload_ledger
    set state = 'committed', verified_bytes = object_size_verified_by_server,
        finalized_at = clock_timestamp()
    where upload_id = requested_upload;
  update viaggio_lab.storage_budget
    set reserved_bytes = reserved_bytes - u.declared_bytes,
        committed_bytes = committed_bytes + u.declared_bytes
    where singleton = 1 returning * into b;
  return b.allowance_bytes - b.reserved_bytes - b.committed_bytes;
end;
$$;

create or replace function viaggio_lab.cancel_upload(requested_upload uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
 b viaggio_lab.storage_budget%rowtype;
 u viaggio_lab.upload_ledger%rowtype;
begin
  select * into strict b from viaggio_lab.storage_budget where singleton = 1 for update;
  select * into u from viaggio_lab.upload_ledger
    where upload_id = requested_upload for update;
  if not found or u.state in ('cancelled','expired') then
    return false;
  end if;
  if u.state != 'reserved' then
    raise exception 'CANNOT_CANCEL_COMMITTED_UPLOAD';
  end if;
  update viaggio_lab.upload_ledger set state='cancelled'
    where upload_id=requested_upload;
  update viaggio_lab.storage_budget
    set reserved_bytes = reserved_bytes - u.declared_bytes
    where singleton=1;
  return true;
end;
$$;

create or replace function viaggio_lab.record_deleted_object(requested_upload uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
 b viaggio_lab.storage_budget%rowtype;
 u viaggio_lab.upload_ledger%rowtype;
begin
  select * into strict b from viaggio_lab.storage_budget where singleton = 1 for update;
  select * into u from viaggio_lab.upload_ledger
    where upload_id=requested_upload for update;
  if not found or u.state='deleted' then return false; end if;
  if u.state!='committed' then raise exception 'OBJECT_NOT_COMMITTED'; end if;
  -- Caller MUST first confirm successful physical deletion from Neon Object Storage.
  update viaggio_lab.upload_ledger set state='deleted'
    where upload_id=requested_upload;
  update viaggio_lab.storage_budget
    set committed_bytes=committed_bytes-u.verified_bytes where singleton=1;
  return true;
end;
$$;

revoke all on function viaggio_lab.reserve_upload(uuid,text,bigint) from public;
revoke all on function viaggio_lab.commit_upload(uuid,bigint) from public;
revoke all on function viaggio_lab.cancel_upload(uuid) from public;
revoke all on function viaggio_lab.record_deleted_object(uuid) from public;
revoke all on table viaggio_lab.storage_budget from public;
revoke all on table viaggio_lab.upload_ledger from public;
