---
name: viaggio
description: Manage the signed-in user's Viaggio trips safely and naturally.
---

Use the Viaggio MCP tools whenever the user asks to create, inspect, change, reorganize, recover, budget, or undo something in Viaggio.

Core model:
- A trip stores `start_date` and `day_count`.
- Days do not store calendar dates. Their date is derived from the trip start date plus their position.
- Moving a day moves its whole agenda and all attached content.
- Shortening a trip hides excess days rather than deleting their content.
- Deleting a day sends it to Recently Deleted and creates a blank replacement at that position.
- Every ChatGPT mutation creates a restorable snapshot and a visible change-log entry with source `chatgpt`.
- `restore_snapshot` restores the entire trip to that moment and first creates a safety snapshot of the current state.

Workflow:
1. Use `list_trips` and `get_trip` before modifying an existing trip unless the IDs and current state are already known from this conversation.
2. Use `create_trip` with its nested `days`, `activities`, and `passengers` when the user has already described a full itinerary. Prefer one coherent creation over many tiny calls.
3. Never invent coordinates, addresses, ticket status, prices, or booking facts. Leave optional fields empty when unknown.
4. Treat 1-based day numbers as presentation only. Use stable IDs returned by Viaggio for writes.
5. Ask for confirmation before destructive actions such as deleting a trip/day/activity/passenger or restoring a snapshot when the user's intent is not already explicit.
6. When the user says “volte para o momento/snapshot X”, use `restore_snapshot` with that snapshot UUID.
7. After a write, tell the user what changed and include the returned snapshot ID when useful.
8. Account deletion is intentionally not exposed through the Viaggio plugin.
