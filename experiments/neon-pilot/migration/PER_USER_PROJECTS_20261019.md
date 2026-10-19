# Per-user project alignment — 2026-10-19

## Applied, not production
The original requirement is one Neon project per user, with cross-project collaboration. Both existing projects still belong to the same Neon organization; this is not separate Neon accounts or independently guaranteed Free allowances.

Operational project A (fragrant-credit-68065034) is bound privately to the existing owner of all four imported trips (Cíntia). Operational project B (sparkling-field-13794641) is bound privately to Paulo. Do not infer this mapping from the older viaggio_collab lab, whose test bindings were left unchanged.

Created the operational schema in B from the existing schema statements. Copied the already-authorized two-row private identity directory and Paulo's one personal profile. B has zero owned trips and zero saved passengers. The four existing trips and their related records remain in A. Existing copies were not deleted. A still retains the original staging copy of Paulo's profile, hidden by the new restrictive personal-profile policy; physical media placement is not fully partitioned yet.

Added private project_binding in each project. Owner-only provisioning sets its singleton row; authenticated clients cannot alter it. Triggers reject trips, personal profiles and saved passengers belonging to a different project owner. Restrictive RLS hides personal records belonging to other project owners. Existing per-trip memberships still govern guest access and editing.

## Verification
Passed on both actual databases using synthetic authenticated claims in controlled SQL:
- Project owner creates and reads a trip; fixture rolled back.
- Other user cannot create a trip in that project.
- Other user cannot read personal profiles from that project.
Also passed in A:
- Paulo sees exactly the one trip shared with him.
- Paulo can edit it with existing editor membership; fixture rolled back.
These are database authorization tests, not real JWT or browser integration tests.

## Blocking next activation
Both Data APIs still expose only public and viaggio_collab, with max_rows=100. No API configuration changed in this turn. The prior automatic-review rejection for exposing viaggio_app remains unresolved. Proposed activation for both projects: add only viaggio_app, keep authenticated sessions, existing CORS and RLS, no anonymous grants, response ceiling1000. Keep viaggio_identity and viaggio_shadow unexposed.

## Required before cutover
- Obtain explicit approval for API activation (previous automatic review requirement).
- Route personal operations to the user's bound project and shared-trip operations to the owner's project.
- Complete private profile-media placement/serving, preserving existing bytes and historical references.
- Implement invitation discovery/routing without trusting client-supplied owner mappings.
- Validate account deactivation across shared-project directory copies.
- Verify login, sharing/revocation, offline queues/conflicts and media with real sessions.
- Refresh source deltas and validate counts/hashes before switching.
Main PWA and Supabase remain unchanged. No production cutover, no paid plan.
