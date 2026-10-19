# Viaggio migration safety checkpoint — 2026-10-19

Production stays on Supabase until verified cutover. Do not delete source records or objects.

Verified staging: four trips including two soft-deleted, 160 state snapshots and 31 historical photos. All 31 historical photos matched source hashes.

Remaining: 76 private Storage objects (about 120 MB) inventoried but not transferred. The application also relies on Supabase Auth, sharing RPCs, storage permissions and offline synchronization. The Neon JSON staging tables are not a drop-in replacement for production relational tables.

Next gate: authenticated, resumable media transfer to a private Neon bucket; verify source and destination size and digest for each object, then audit quota and missing objects. Keep source intact.

After that: implement relational schema and row-level authorization, validate family accounts and sharing, test offline editing and conflict recovery on an isolated preview, and perform an explicit approved cutover with rollback.
