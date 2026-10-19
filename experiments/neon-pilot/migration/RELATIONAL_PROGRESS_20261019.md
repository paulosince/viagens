# Operational schema progress — 2026-10-19

## Completed

- Created isolated `viaggio_app` (15 application tables, 48 constraints, 36 RLS policies) and private `viaggio_identity` schemas in project `fragrant-credit-68065034`, branch `br-dawn-bread-b83r0ztn`, database `viaggio_lab`.
- Preserved the application's column types and relationships. All application tables have RLS enabled. The identity directory has no browser SELECT grant. Internal snapshot helpers have no authenticated EXECUTE grant; only reviewed application entrypoints are granted.
- Added immutable trip ID/owner protection and resolved ambiguous member-column references in `share_trip_with_email`.
- Executed `verify-relational.sql` successfully against Neon: owner creation/read, history capture/baseline/restore, sharing by email, viewer write denial, editor write permission, ownership-change denial, revocation, unrelated-user isolation, missing-identity isolation, and no anonymous schema access.
- Tests use synthetic `example.invalid` identities. A nested transaction rolls back every fixture. Verified operational trips and identities are both zero after testing.
- Compared source counts with the preserved shadow copy. All 15 source table counts match (including an empty invitations table). All 31 historical photo payload hashes match. All 160 history states have matching PostgreSQL semantic JSON hashes. Raw textual hashes differ for 32 histories because JSON number representations differ; an affected record also compared equal after JSON parsing. Aggregate photo text hashes differ due ordering/serialization, while individual photo hashes match.
- The previous 76-object private-media checkpoint remains valid; this step made no media changes.

## Explicit current blocker

Automatic approval review rejected copying the two account identities from Supabase to Neon, because it includes another person's private email and user ID and requires explicit authorization for this payload/destination. Do not retry, replace identity rows with placeholders, or route around that rejection without authorization.

The attempted operational-data transaction failed its first foreign-key check because the identity directory is empty. It did not partially populate the operational tables. Source data is untouched.

## Not complete

- Operational data population awaits explicit identity-copy authorization.
- `viaggio_app` is deliberately not in the Data API exposed-schema list yet. Existing experimental endpoints are unchanged.
- Login is still Supabase Auth. Neon Auth is not enabled. Passwords, password hashes, tokens, sessions and OAuth secrets were not copied or accessed for this migration.
- The frontend, private-media serving/upload adapter, Unsplash function, ChatGPT MCP/OAuth connection and offline outbox still require integration and end-to-end validation before production cutover.
- Keep source data and production endpoint intact. Recheck source deltas before cutover. The copied identity directory is an application FK/lookup directory, not a migrated authentication system.

## Resume

1. Obtain explicit authorization for copying account IDs, email addresses, profile-name metadata, email-verification timestamps and account-deletion status for both existing family accounts into the private Neon identity directory. No passwords or sessions.
2. Re-read those permitted fields, populate the identity directory, then import the shadow rows in dependency order. Verify typed-row equality and snapshot/photo integrity.
3. Finish authenticated API/media/client integration and live-session tests, keeping offline preview data isolated from production outbox.
4. Publish a production cutover only after the app works with rollback and account migration handled explicitly.

`relational-schema.sql` is a one-time transactional schema creation script; do not blindly rerun on an existing schema. `build-relational.py` regenerates it from a private, administrator-exported catalog containing schema definitions only.
