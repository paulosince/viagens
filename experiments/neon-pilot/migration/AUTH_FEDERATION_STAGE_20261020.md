# Viaggio Auth federation — verified staging milestone (2026-10-20)

## Architecture (kept as agreed)
- Closed beta for up to 20 people, one separate Neon project per user, initial Viaggio allowances of 400 MB database and 4 GB files per user, quota enforcement and registration admission to be implemented.
- A third dedicated project `viaggio-auth-beta` in the same Free organization is the sole intended login issuer; per-user projects still retain their own application data, files and RLS.

## Executed

### Central Auth
- Project `dark-union-03886858`, branch `br-square-river-b765bpl4`, database `viaggio_auth`.
- Created the project, provisioned Managed Better Auth, named the integration `Viaggio`, and allowed trusted origin `https://paulosince.github.io`. Config re-read.
- Central Auth base URL: `https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth`.
- Central signing JWKS: `https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth/.well-known/jwks.json`.
- No family account created or credential imported; `neon_auth.user` is empty. Email verification is **not enabled**, default dev SMTP remains configured. No registration promotion yet.

### Per-user validation branches, NOT main
- Trip-owner project A: `fragrant-credit-68065034`, branch `br-silent-band-b80nklzl`, DB `viaggio_lab`. Staging Data API: `https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1`.
- Paulo project B: `sparkling-field-13794641`, branch `br-falling-leaf-b8xuv1d0`, DB `viaggio_lab`. Staging Data API: `https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1`.
- The staging Data APIs were re-provisioned with the central JWKS as the sole *external* provider. Preserved `viaggio_app` exposed schema, anonymous role, RLS tables, 1000-row response ceiling, CORS origin, OpenAPI disabled. Both were read back as active; signed-token end-to-end verification remains to be performed.
- Created `viaggio_identity.neon_auth_links`, private mapping of central Auth UUID to existing application UUID. Only administrative dual-session validation may insert a mapping; unverified email alone is never enough. Updated the private `viaggio_identity.uid()` RLS identity helper **on staging only** to return a legacy ID only for a verified mapping.
- Confirmed: anonymous/authenticated lack direct SELECT on the mapping table, anonymous lacks EXECUTE on helper, authenticated retains EXECUTE, no links persist after controlled tests. Parent main branches have **no** mapping table and their original auth flow was not changed.

## Tests (controlled SQL claims, NOT a real JWT login)
- B: linked owner resolves home=true and reads one personal profile; unlinked UUID resolves NULL, home=false and zero profiles. PASS.
- A: linked trip owner resolves home=true and sees four trips; linked separate shared-trip participant home=false and sees exactly one trip; unlinked UUID resolves NULL and sees zero trips. PASS.
- Synthetic test mappings were deleted within the respective transactions. Both staging tables now have zero rows.
- Regression suites G2/G3/G4 from earlier checkpoints should not be re-run from zero. Only signed-token / new provider regressions and unfinished end-to-end scenarios remain.

## Before any production switch
1. Enable **verified email signup** on central Better Auth (shared development SMTP can send OTP; dedicated SMTP strongly recommended for production). Put new registrations behind the Viaggio beta admission gate, not open signup.
2. Implement a server-side **dual-session proof**: validate a live Supabase JWT identifying the already-linked legacy account, independently validate the new *central* Neon session and email verification, and create the identity mapping administratively on both user databases. Never trust browser-supplied identifiers for role binding.
3. Obtain a real central Auth session and verify the SAME signed token can query both staging APIs; test denial, refresh, logout, cross-project owner/editor/viewer and media permissions. No real-user mapping has yet been performed.
4. Switch the isolated GitHub Pages preview only after above, then test offline queues/reconnect, file writes and usage quota before planning production cutover.
5. Reconcile source deltas and retain a verified rollback. Do not change or delete Supabase production credentials, DB or files.

## Implementation source
See `auth/federated-identity-stage.sql` (apply only to staging; already applied to both validation branches).

## Documentation
https://neon.com/docs/auth/migrate/from-supabase
https://neon.com/docs/auth/production-checklist
https://neon.com/docs/data-api/manage

## Independent-work continuation — 2026-10-20
- Added `migration/auth/check-federation.mjs` and `migration/auth/check-federation.test.mjs` to the migration branch only; these do not ship with the production PWA.
- A local Node smoke-check implementation passed 8/8 mocked tests covering no link, valid linked project route, forged JWT rejection, anonymous denial, signed JWT rejection, wrong home, private-trip exposure and missing token. The committed code is an independent runner for the **real-token** step; no real Neon session was available to execute it live. No credentials were copied or committed.
- Test checker uses a short-lived JWT passed through `VIAGGIO_CENTRAL_NEON_JWT` (local environment or masked CI secret), never in source. Optionally set `VIAGGIO_EXPECTED_HOME=b` for Paulo or `a` for Cíntia after a verified identity link. Do not send tokens through chat.
- Control-plane blocker: available Neon connector actions can change the Auth name, trusted origins, and OAuth providers, but cannot enable required email verification or configure a custom SMTP server. Central Auth still allows unverified sign-ups; do not treat it as production-safe.
- Hard stop: no family password migration, newly bound user, or signed-token access test has yet passed. Mapping demands a separately verified legacy session and new verified Neon identity. No irreversible production cutover without direct account-holder verification.

## Continued authorization implementation — 2026-10-20, later session

Added migration-branch-only, server-side components:
- `auth/identity-proof-core.mjs` and unit tests: verify both independently authenticated identities, require legacy email confirmation and central database `emailVerified=true`, require consistent email, reject deleted/banned users and mismatched subject IDs; only output the private linkage fields, never a token.
- `auth/trusted-auth-adapters.mjs` and unit tests: obtain the legacy principal via a server-to-Supabase Auth /user request, verify a central JWT with a pinned JWKS and expected issuer through a supplied `jose` verifier, and read Neon user state via parameterized private SQL; these adapters must run server-side, never in the PWA.
- `.github/workflows/viaggio-neon-auth-checks.yml`: syntax checks and `node --test experiments/neon-pilot/migration/auth/*.test.mjs` on changes to this branch (also PR/manual triggers).

**Actual local Node.js execution:** 25 tests passed out of 25, zero failures (8 federation simulations + 10 identity-proof + 7 trusted-auth-adapter simulations). The tests mock remote responses; this is not proof of a deployed integration. A GitHub Actions run was not independently confirmed.

**Independent safety reads:** central Better Auth still has zero real users; user-project parent branches have no federated link table and are untouched; A staging had zero persisted mappings. No real account tokens were accessed, transferred or saved. A separate B staging read was blocked by an automated safety check, so do not claim a new independent read of its count; earlier staging checks had zero links.

**Hard integration remaining:** wire the adapters to a private backend with real `jose` JWT verification and a protected admin-only link-write transaction. Obtain and validate a genuine central token and signed cross-project requests. For any legacy account, both identities must be independently proven and the Neon address verified before linking. An external endpoint and account migration are *not* deployed. The required email-verification toggle is still unavailable through the currently exposed Neon connector operations; production-grade SMTP and beta admission controls also remain pending.

No change to production Supabase, its main application, or the two per-user main-branch Neon Data APIs.
