# Viaggio — Neon Auth checkpoint (2026-10-19)

## Verified operational changes

- Project A (fragrant-credit-68065034, branch br-dawn-bread-b83r0ztn, owner Cíntia): Managed Better Auth was already enabled; its application name is now **Viaggio**.
- Project B (sparkling-field-13794641, branch br-proud-paper-b83l1z7d, owner Paulo): enabled Managed Better Auth and registered **https://paulosince.github.io** as a trusted origin; application name is now **Viaggio**.
- Both project Auth configurations were reread, and both allow that origin.
- Both `neon_auth.user` directories are currently empty; no live family user has been migrated.
- Production GitHub Pages PWA is unchanged. The isolated Neon preview still authenticates using Supabase, and its app routing uses the previous Supabase token in both Neon Data API clients. Do not invalidate that provider yet.
- Source Supabase has two email identities (no OAuth provider identities).
- All existing `viaggio_app` user ownership/membership references use legacy Supabase UUIDs. The private `viaggio_identity.uid()` function currently maps an authenticated JWT's UUID `sub` directly and does not map Neon-generated IDs.

## Architecture and safety blockers

**Do not cut over to Neon Auth yet.** Provisioning Auth in both projects creates two separate session/identity issuers, not a single cross-project login. One frontend user must be able to access their home project and trips shared from another project with a token accepted and mapped consistently in both.

- Designate a single identity issuer/federation model. If using one project's Neon Auth, configure the other project's Data API to trust that issuer's JWKS; do this in staging first and preserve the currently working Supabase-JWT preview. The Neon Data API supports replacing a JWKS provider, but only one provider at a time; it may require explicit migration/testing to avoid breaking the existing preview.
- The official **Managed Better Auth** Supabase migration guide states that existing password hashes are not transferable (distinct hashing algorithms). The older Neon blog covering Stack Auth is *not* applicable to these Better Auth integrations. The two existing email/password users therefore need securely initialized new credentials (for example, an email-verified onboarding/reset flow), not raw passwords in GitHub/ChatGPT.
- New Neon Auth accounts generate independent UUIDs. Do not grant any old trip rights just by matching an **unverified** email or by trusting client-provided IDs. Implement and verify an auditable server-side linkage from independently proven legacy identities to verified new identities, or a supported ID-preserving onboarding method. Ensure the association is applied across owner and shared projects before any data access.
- Both Auth instances currently permit signup *without email verification* and use the default shared development SMTP and shared Google OAuth credentials. Their production checklist also requires trusted origins, verified email, appropriate email/OAuth provider, and disabling localhost. No passwords, hashes, sessions, or tokens have been moved.
- Maintain fail-closed account deletion, revocation of shared access, private photo permissions, and independent user home projects.

## Next technical work

1. Create an isolated authentication test (not main PWA) with a single issuer and the official `@neondatabase/neon-js` client (`SupabaseAuthAdapter` if retaining current auth call signatures). Explicitly test cross-project JWT trust and RLS.
2. Develop a verified legacy-user linkage, secure onboarding, and tests for unauthorized / unverified email collisions and changed UUIDs. Prefer reversible migrations and no automatic user creation without proof of address control.
3. Confirm login/logout, session refresh and persistence, multiple family members, permissions, and all media read/write using *real* sessions.
4. Refresh production-source deltas, compare record and byte counts/hashes, and switch production only after complete verification.

## Sources

- https://neon.com/docs/auth/migrate/from-supabase
- https://neon.com/docs/auth/production-checklist
- https://neon.com/docs/data-api/manage
