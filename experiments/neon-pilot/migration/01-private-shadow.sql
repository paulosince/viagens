-- Viaggio: private, reversible, read-only staging copy of Supabase state.
-- Never expose this schema through the Neon Data API. Do not use it as an app store.
-- No source objects or original Supabase records are modified by this SQL.
create schema if not exists viaggio_shadow;
revoke all on schema viaggio_shadow from public;
revoke all on schema viaggio_shadow from authenticated;

create table if not exists viaggio_shadow.rows (
  source_table text not null,
  record_key text not null,
  payload jsonb not null,
  copied_at timestamptz not null default now(),
  primary key(source_table,record_key),
  check (source_table = any(array[
    'trips','passengers','saved_passengers','passenger_profiles','trip_days',
    'activities','day_locations','budget_items','checklist_items','day_attachments',
    'snapshot_photos','state_snapshots','change_log','trip_members','trip_invitations'
  ]))
);


create table if not exists viaggio_shadow.media_inventory (
  bucket_id text not null,
  object_key text not null,
  expected_size bigint not null check(expected_size>=0),
  content_type text,
  source_metadata jsonb not null default '{}'::jsonb,
  inventoried_at timestamptz not null default now(),
  primary key(bucket_id,object_key)
);

create table if not exists viaggio_shadow.copy_runs (
  run_id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  source_project text not null,
  label text not null,
  status text not null default 'in_progress' check(status in ('in_progress','verified','incomplete')),
  source_counts jsonb not null default '{}'::jsonb,
  dest_counts jsonb not null default '{}'::jsonb,
  notes text
);

revoke all on all tables in schema viaggio_shadow from public;
revoke all on all tables in schema viagem_shadow from authenticated;
