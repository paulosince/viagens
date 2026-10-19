# Account directory and operational data copied — 2026-10-19

The user explicitly approved the previously blocked transfer of the two family account IDs, email addresses, names, verification timestamps and deletion status into the private Neon database. The authorized fields were reread and copied in the same transaction as the operational data. No password, password hash, session or token was read or copied.

## Verified result

- Two account-directory rows in `viaggio_identity.users`.
- 610 application records populated across 15 tables in `viaggio_app` (one table is empty).
- All 15 table counts and aggregate PostgreSQL semantic JSON hashes match the current source. All foreign-key constraints validated during the transaction.
- Four trips, five memberships, two passenger profiles, five saved passengers, 15 trip passengers, 24 trip days, 84 activities, 67 locations, 31 checklist items, 21 budget items, four attachments, 160 snapshots, 157 change-log records, 31 historical photos and zero pending invitations.
- The 76 copied private objects were registered in a private media directory for authenticated serving. The original source and destination objects were not overwritten.

## Prepared private-media service

Source: `experiments/neon-pilot/functions/appmedia/`.

- Fixed private destination bucket; authorization delegated to the JWT-verified Data API RPC, with per-trip and profile permissions.
- Bounded upload bodies, 4 GB allocation ceiling, pending reservations counted against the ceiling, immutable object keys and physical size/hash verification.
- Logical file deletion preserves the physical bytes for rollback.
- Eight local service tests passed: anonymous denial, unauthorized trip denial, byte-exact read, origin denial, absent-object denial, bounded upload, key validation and all-or-nothing authorization before logical removal.
- Package versions pinned with a lockfile; built successfully for Node 24. Not deployed yet. Upload/concurrency behavior still needs live verification.

## New review block: API configuration

Automatic review rejected adding `viaggio_app` to Data API exposed schemas while raising `db_max_rows` to 10000. It requires explicit authorization for the API security-boundary change, or a materially safer design. Do not bypass the rejection.

Concrete reduced proposal awaiting authorization:

- Add only `viaggio_app` to the existing Data API schema list, retaining existing `public` and `viaggio_collab` compatibility.
- Set the response ceiling to 1000 rows, rather than the rejected 10000, to accommodate the app's 150-entry history queries.
- Preserve the signed-session authentication provider, existing origin restriction and anonymous role with no privileges on the application schema.
- Keep `viaggio_identity` and `viaggio_shadow` unexposed. All operational tables retain RLS, and only reviewed app RPC entrypoints can be called by authenticated users.

## Still outstanding

The main PWA continues to use Supabase. Copying the account directory is not migration of login: Neon Auth remains disabled and no account sessions have changed. Authenticated API activation, private-media deployment, frontend integration, Unsplash, ChatGPT MCP/OAuth, offline outbox isolation, live family-account tests and production cutover remain outstanding. Refresh source deltas before cutover.
