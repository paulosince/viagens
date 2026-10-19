# Neon application preview — 2026-10-19

Published isolated application at experiments/neon-pilot/app/ on main, without modifying the main application shell or production database client. Generated from the current main app; regeneration script retained. Supabase JS pinned to 2.118.0 in preview.

Implemented project-aware routing: personal records to authenticated home project, shared-trip operations to owning project, cross-project read merging/order/limit, fail-closed ambiguous/unscoped/cross-project mutations, no silent partial results if one project fails. The database remains the authority for permissions. Private home discovery RPC project_context installed on both projects; no anonymous execution.

12/12 local router tests passed. Static checks confirm distinct IndexedDB and media-cache names, no production service-worker registration or manifest, and asset paths constrained to the application origin. Navigation bug caused by base href was identified during real-browser testing and fixed by explicit asset paths.

Real signed-in browser session loaded Paulo's personal profile, the one shared trip and its five passengers, then all fourteen itinerary days and their activities from Neon. The application reported offline cache ready; this is not a network-disconnection/reconnection test. No real-session mutation test has passed yet.

Transitional dependencies are explicitly displayed in the preview: Supabase still supplies login and existing media reads. Source media upload/remove calls are blocked. New signup and account deletion are blocked until provisioning and cross-project deactivation are implemented. Usage reporting, ChatGPT integration, profile propagation and cross-project bulk operations are not complete. Private media Functions have not been deployed. Do not switch production or claim complete migration.

Preview edits would change the Neon copy only, with a distinct offline outbox; they must be reconciled before a final source refresh/cutover. Existing main PWA remains production on Supabase.
