# Architecture

## Layers

- **UI** — Next.js App Router pages under `src/app`, shared components in `src/components`.
  The signed-in app lives under `/app`; `/shared#<token>` is the read-only share view.
- **Domain logic** — pure TypeScript in `src/lib` (no React, no network), unit tested:
  extraction parsers, schedules and reminder planning, comparison, explainer,
  assistant retrieval, safety rules, search, timeline, share links, export.
- **Workspace store** — `src/lib/store.tsx`. Every page reads one `AppState` and every mutation
  goes through `update()`, which also appends to the audit log. Two modes, never mixed:
  - *demo*: the workspace lives in `localStorage` (`healthos-demo-v1`), original files in IndexedDB;
  - *cloud* (signed in): `src/lib/cloud/sync.ts` loads everything the account may see from Supabase
    (RLS decides), keeps it in memory only, and after each change writes back just the rows that
    changed (`diffRows` in `src/lib/cloud/tables.ts`), parents before children, deletions children
    first. Failed writes are retried with backoff and shown as "Not saved · Retry"; leaving the page
    with unsaved changes asks for confirmation. Original files go to the private bucket at
    `<profile>/<document>/1/<file>`.
- **Server** — route handlers in `src/app/api` for AI explain, OCR, the reminder cron and
  a health check; Supabase server clients in `src/lib/supabase`.
- **Database** — `supabase/migrations/0001_init.sql`. All tables have RLS; access is decided by
  `can_access_profile(profile_id, need_edit)` (owner, or an active, unexpired grant with the right role).
  Observation corrections are written to an append-only `observation_revisions` table.
  Files go to the private `medical-documents` bucket under `<profile_id>/...`.

Other server pieces for signed-in accounts:
- `accept_pending_grants()` links email invitations to the invited person when they sign in.
- `shared_packet(token)` returns a read-only bundle for a share link; only the token's SHA-256 is stored,
  so a link is shown once when it is created.
- `/api/account/delete` removes the account's original files and then the auth user (all tables cascade).
- `rate_limit_hit()` backs the AI/OCR rate limits so all server instances share counts.
- The reminder cron sends Web Push to every device a user turned on, and deletes subscriptions the
  browser vendor reports as gone.

## Safety design

| Rule from the plan | Where it is enforced |
| --- | --- |
| Never invent reference ranges or values | `explain.ts` only uses values/intervals on the observation; missing ones are listed as "not known" |
| Flag uncertain extraction (OCR confusions, missing units, odd values) | `labParser.ts` `reviewReasons` + confidence; UI shows "Needs review" until confirmed |
| Never guess dose or frequency | `rxParser.ts` leaves fields empty with a reason; schedules need a per-item "checked against original" |
| Compare only same test **and** unit, neutral wording | `compare.ts` (`buildComparisons`, `describeChange`) |
| Never assume a dose was missed | `schedule.ts` states: unrecorded past doses are "not recorded", never "missed" |
| Reminders: no duplicates, quiet hours, honest delivery state | `reminders.ts` idempotency keys + unique DB constraint, retries with `MAX_ATTEMPTS`, failures recorded |
| Urgent symptoms → emergency guidance, no analysis | `safety.ts` `detectUrgent` runs before anything else in the assistant |
| Documents are data, not instructions | `wrapUntrustedDocument` + system prompt for the AI provider; built-in assistant never executes text |
| Drug interactions | Not shown: requires a licensed interaction source (the UI says so) |
| Share links | 32-byte random tokens, stored only as SHA-256, expiry, revocation; token in URL fragment so it isn't logged |
