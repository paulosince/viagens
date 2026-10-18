-- Laboratório Neon do Viaggio (sem dados reais, sem migração)
-- Executar somente em um projeto Neon descartável, nunca no Supabase de produção.
-- Um projeto Neon = um proprietário de dados do Viaggio.
-- A camada de API deve autenticar o usuário e aplicar as permissões antes de acessar este schema.

create schema if not exists viaggio_lab;

create table if not exists viaggio_lab.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 150),
  created_at timestamptz not null default now()
);

create table if not exists viaggio_lab.deadlines (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references viaggio_lab.trips(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  due_at timestamptz not null,
  kind text not null default 'other' check (kind in ('ticket','booking','trip','other')),
  created_at timestamptz not null default now()
);

create table if not exists viaggio_lab.files (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references viaggio_lab.trips(id) on delete cascade,
  object_key text not null unique,
  size_bytes bigint not null check (size_bytes >= 0),
  content_type text not null,
  created_at timestamptz not null default now()
);

-- Schema privado enquanto não houver autenticação, RLS e testes de compartilhamento.
revoke all on schema viaggio_lab from public;
