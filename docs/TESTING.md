# Testing

| Command | Covers |
| --- | --- |
| `npm test` | 72 unit tests: lab parser (units, Indian digit grouping, OCR "O"/"0" confusion, missing units), prescription parser (never guesses dose/frequency, 1-0-1 patterns), schedules across DST, dose states, reminder idempotency and quiet hours, comparison by unit with unverified-value caveats, explainer grounding, assistant safety (urgent symptoms, medicine-change refusals, prompt injection in documents), share links, ingest, and the cloud mapping (round trip, minimal diffs, delete order, token hashing) |
| `npm run typecheck` | Strict TypeScript |
| `npm run build` | Production build of every route |
| `npm run test:db` | Applies all migrations to a throwaway Postgres 15+ and checks RLS (owners, strangers, viewers, revoked grants, constraints), then runs `tests/cloud.db.test.ts`: saves the full sample workspace through the sync layer and reads it back unchanged, applies edits and deletions, blocks another account, links an emailed invitation, opens a share link only with the right token, keeps the audit trail append-only, and checks the shared rate limiter |
| `npm run test:e2e` | Browser test of a real account against a local Supabase (below) |

## End-to-end against a local Supabase

1. Install the Supabase CLI and Docker, then in a scratch folder run `supabase init`, copy
   `supabase/migrations/*` into it, and add a test phone code to its `supabase/config.toml`:
   ```toml
   [auth.sms]
   enable_signup = true
   [auth.sms.test_otp]
   919876543210 = "123456"
   [auth.sms.twilio]   # any values; the test code means nothing is sent
   enabled = true
   account_sid = "ACtest"
   message_service_sid = "MGtest"
   auth_token = "test"
   ```
2. `supabase start`, then build and start this app with `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from `supabase status`.
3. `BASE_URL=http://localhost:3000 npm run test:e2e -- ./screenshots`

The script signs up with phone OTP, sets a password, onboards, uploads a lab report, reloads to
confirm it came back from the database, creates a share link and opens it signed out (and checks a
tampered link is refused), signs out and back in with the password, then deletes the account. It
fails on any browser console error.

## Done on 11 Oct 2026

All of the above passed, including the end-to-end run against Supabase CLI 2.48.3 (Postgres 17,
GoTrue, PostgREST 13, Storage). After account deletion the database held no users, profiles,
documents or stored files. The reminder job was also run against the same stack: it planned a due
dose once (a second run planned nothing), and recorded "Email provider not configured" / "Browser
push not configured" as delivery failures with retries, as intended without those keys.

## Not yet tested

- A hosted Supabase project, real SMS delivery, Google sign-in (needs OAuth credentials).
- Real AI provider (explanations, OCR), Resend, Twilio, Web Push delivery to a real browser, Vercel Cron.
- Screen reader passes (semantic markup, labels and focus states are in place; no assistive-technology session was run).
