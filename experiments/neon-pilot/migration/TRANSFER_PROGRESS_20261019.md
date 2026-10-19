# Media transfer checkpoint — 2026-10-19

Production remains on Supabase. No source objects were deleted or replaced. No application cutover was performed.

## Verified result

- 53 of 76 inventoried private objects copied to the private Neon bucket.
- 65,049,788 bytes copied.
- 42 trip images, 4 day attachments and 7 profile photos copied.
- Every successful upload validated byte count and SHA-256 against the source bytes.
- A separate physical verification pass reread all 53 copies from Neon: 53/53 intact, zero failures.
- Confirmed inventory metadata in viaggio_shadow.media_inventory uses neon_key, neon_sha256 and neon_verified_bytes (the deployed g3auto route). Do not rely only on neon_storage_key, which belongs to the alternative undeployed g3media implementation.

## Remaining blocker

23 trip images returned Object not found through the authenticated source Storage API. Their metadata exists in Supabase. They belong to three trips for which the current authenticated account has no trip_members membership (21 objects in one active trip, one object in each of two soft-deleted trips). This is not evidence of physical loss. Resume through a legitimately authorized owner session or an approved administrative migration path; do not weaken storage policies or make buckets public.

The deployed transfer UI is experiments/neon-pilot/migrar-arquivos.html and uses g3auto?migration=list/upload/verify. The separate media-one.html targets g3media, which was not deployed at inspection time. Resume is idempotent and skips records already marked copied.

Auth, relational compatibility, sharing and offline synchronization still require validation before any production cutover.
