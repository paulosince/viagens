# Viaggio / Supabase → Neon / 14-step migration
## Step 01 of 14 — Consolidate identity-linking and activation SQL
**State: COMPLETED in the defined scope.** Date: 2026-10-21.

### What changed
The versioned `auth/federated-identity-stage.sql` was updated to represent the actual schema and `viaggio_identity.uid()` behavior installed in **both validation branches**:
- `activated_at timestamptz`, nullable, added idempotently to pre-existing link tables;
- private `neon_auth_links`, unique central subject and unique legacy subject, FK to private user directory, RLS enabled and no direct grants to `anonymous` or `authenticated`;
- `viaggio_identity.uid()` is `SECURITY DEFINER`, `STABLE`, `search_path = ''`, receives only JWT claims already validated by the Data API, and maps only identities with proof `dual_session`, non-null `verified_at` and `activated_at`, plus a legacy user with `email_confirmed_at` and no `deleted_at`;
- `authenticated` has EXECUTE on the helper; `anonymous` and PUBLIC do not.
The file is designed for **validation branches**, not the two main branches. No migration was run against a main branch in this step.

### Actual staging verification (real databases; claims simulated, NOT a signed Neon token)
- Project A (`fragrant-credit-68065034`), validation branch `br-silent-band-b80nklzl`:
  - prepared link: identity resolution NULL and **0** visible trips: PASS
  - activated link: identity resolves and **4** owner-visible trips: PASS
  - deactivated link: identity resolution NULL and **0** visible trips: PASS
  - final synthetic mapping count: **0**, after rollback to savepoint: PASS
- Project B (`sparkling-field-13794641`), validation branch `br-falling-leaf-b8xuv1d0`:
  - prepared link: identity resolution NULL: PASS
  - activated link: identity resolves and **1** owner-visible profile: PASS
  - deactivated link: identity resolution NULL and **0** visible profiles: PASS
  - final synthetic mapping count: **0**, after rollback to savepoint: PASS
- In BOTH validation branches, verified PostgreSQL grants:
  - direct SELECT on link table: anonymous=false, authenticated=false;
  - EXECUTE private resolver: anonymous=false, authenticated=true.
- GitHub version reread and checked: activation column, idempotent ALTER, activation predicate, account confirmation/deletion guard, and privilege clauses all present. No stray test placeholders.

### Security and rollout boundary
- These are real PostgreSQL authorization tests with **synthetic request JWT claims**, not an end-to-end test of a genuinely signed token.
- The central Neon Auth has not migrated family accounts, and the actual verified-email requirement belongs to step **02**.
- Linking via a protected private backend, proofs of both sessions, synchronization of activations across projects and real signed JWT are steps **03–04**; do not mark them complete.
- GitHub production `main`, original Supabase, and Neon project main branches were not modified in this step.
- The safety property for a partially prepared link is fail-closed until `activated_at` is set, but the distributed activation workflow must be built separately.

### Next agreed item
**Step 02/14:** require verified email on the CENTRAL Better Auth only, with production-grade identity verification configuration. Do not alter the 14-item scope or re-open step 01 absent a specific regression.
