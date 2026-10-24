# Usage integration — 2026-10-24

The home requested `viaggio_my_usage`, but the Neon router rejected it and the
function was absent from the app schema. The prior composition chart was not a
measurement of remaining quota.

## Implemented

- Owner-only SQL RPC in `usage.sql`, tested first in `br-dry-snow-b8gdgcin`,
  then installed in the existing A/B application branches.
- Database bytes: sum of `pg_database_size` for the branch's databases, including
  infrastructure/history/index overhead. Limit comes from the compute's actual
  `neon.max_cluster_size` setting (381 MiB = 399,507,456 bytes at verification).
- File allowance: existing `v2_storage_budget.allowance_bytes` (4,000,000,000).
- `appusage` Function authenticates through the existing Neon Data API and
  owner-only RPC before reading storage. It paginates S3 ListObjectsV2 to sum
  physical objects, including retained replacements and logically deleted files.
- Active image/attachment subtotals use metadata; they need not sum to the
  physical total. The full total includes retained/unreferenced objects.
- The browser routes usage to the personal project only. It displays independent
  percentages against limits, not database/files composition. Missing data stays
  unavailable. Old cache formats are ignored and account switches clear readings.
- Service-worker cache and changed module URLs bumped to `20261024-usage2`.

## Verification completed

- 11 local checks passed: pagination, missing/malformed data, empty bucket,
  repeated pages, signing, authorization-before-storage, owner routing,
  independent quotas, over-limit display and actual renderer output.
- SQL executed as `authenticated` using transaction-local owner test claims in
  the isolated branch and both application branches. Anonymous, missing-identity
  and non-owner cases were rejected in the isolated branch. These are SQL role
  tests, not proof of a live browser JWT session.
- Physical bucket inventories independently read through Neon: A 119,638,614
  bytes / 77 objects; B 12,454,379 bytes / 14 objects.
- The deployed storage signer/reader in the isolated branch returned exactly
  119,638,614 bytes / 77 objects, matching the independent inventory. The
  secret-protected probe was replaced by a 410 response afterward.
- Both production `appusage` Functions deployed successfully. Live calls without
  a bearer token returned 401. Invalid bearer tokens failed without returning data.
- JavaScript syntax and git whitespace checks passed.

## Outstanding / limits

- Automatic approval review blocked publishing the frontend to GitHub main even
  after the user's follow-up authorization. Local commits are ready for publication.
- A full positive request using the user's real browser session and visual iPhone
  verification remain untested. Do not describe those as passed.
- This change measures usage; it does not repair enforcement in all existing upload
  paths. In particular, the appmedia writer does not currently use the v2 reservation
  ledger. Therefore the displayed file allowance is configured, not a newly proven
  hard limit. Physical measurement intentionally does not rely on ledger totals.
- SQL database sizes are a Postgres snapshot, not Neon's organization-wide billing
  usage. Concurrent uploads can change file totals during a multi-page inventory.

## Follow-up: N/D and header revision

The user reported N/D in the actual authenticated session after publication.
The earlier local checks were not evidence of a successful live JWT request.
Neon documentation requires refreshing the Data API schema after adding RPCs;
that step was omitted. On 2026-10-24 both app branch Data APIs were refreshed
using an empty update request (no permission or schema exposure changes).
Owner-only auth remains unchanged. The service now logs the upstream status and
sanitized error code/message for diagnosis, without logging tokens.
A subsequent real authenticated request is still needed to confirm that this
was the only cause. Do not claim N/D is solved based only on a schema refresh.

The home now labels usage as Armazenamento, with plane/image icons, puts sync
below the avatar and the text Editar in the upcoming section. The header's
expanded content scrolls naturally while the compact title stays sticky.
The local Chromium test confirmed the sticky title sits at y=0 with height
44px at 390px width, no horizontal overflow, and Editar in the section heading.
The 11 measurement checks passed again; they are now included in CI.
