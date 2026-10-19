# Data API activation — 2026-10-19

Paulo explicitly approved activating the application tables on both project APIs with authentication, per-trip permissions, no anonymous access and a 1000-row response ceiling.

Applied and reread on fragrant-credit-68065034 / br-dawn-bread-b83r0ztn and sparkling-field-13794641 / br-proud-paper-b83l1z7d, database viaggio_lab:
- db_schemas: public, viaggio_collab, viaggio_app
- db_max_rows: 1000
- db_aggregates_enabled: false
- db_anon_role: anonymous
- jwt_role_claim_key: .role
- openapi_mode: disabled
- server_cors_allowed_origins: https://paulosince.github.io

The update tool replaces unspecified settings with defaults: an initial partial update reset aggregates/CORS. A complete update restored the original restrictions; both final configurations were reread and verified. Future updates must explicitly preserve these fields.

SQL checks on both projects confirmed: anonymous has no application-schema USAGE; zero application tables lack RLS; authenticated cannot SELECT viaggio_identity.users. Private identity/shadow schemas are not exposed. An unauthenticated HTTP request to project A was rejected with missing authentication credentials, without data.

This resolves the prior API-activation approval blocker. Main PWA still uses Supabase. Real-session integration, project routing, media serving, cross-project lifecycle and offline validation remain outstanding; production migration is not complete.
