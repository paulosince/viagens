alter table public.change_log
  add column if not exists source text not null default 'viaggio',
  add column if not exists client_id text;

comment on column public.change_log.source is
  'Origin of the change, for example viaggio, chatgpt, api, or restore.';

comment on column public.change_log.client_id is
  'OAuth client identifier when the change came through an external agent.';
