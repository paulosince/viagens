-- A trip snapshot includes the original photos so restoring it remains lossless.
-- Large trips can exceed the authenticated role's default 8-second API timeout.
alter function public.capture_trip_snapshot(uuid, uuid, text)
  set statement_timeout to '30s';

-- Supabase owns OAuth consents in the auth schema. Return only a boolean for
-- the signed-in user; never expose another user's authorizations or tokens.
create or replace function public.has_chatgpt_connection()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.oauth_consents consent
    join auth.oauth_clients client on client.id = consent.client_id
    where consent.user_id = (select auth.uid())
      and consent.revoked_at is null
      and client.deleted_at is null
      and client.client_name = 'ChatGPT'
  );
$$;

revoke all on function public.has_chatgpt_connection() from public, anon;
grant execute on function public.has_chatgpt_connection() to authenticated;
