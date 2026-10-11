# Release readiness

Status as of 11 Oct 2026. "Tested" means automated tests or a local run, not production use.

## Implemented and tested locally

- Demo workspace with fictional people and records, built by running the real parsers on synthetic text.
- Records vault: upload (PDF/TXT/DOCX text extraction in the browser, images stored for OCR), categories, tags, edit, replace, delete, original download.
- Lab report extraction with confidence and review reasons; confirm/correct values with history kept.
- Report explainer (simple, detailed, single result, terms, summary, questions for the doctor) grounded in the report's own lines, with citations and a clear "not known from your report" section.
- Comparison over time only for the same test in the same unit; neutral wording; caveat when a value is unverified.
- Prescription review: nothing becomes a schedule until each item is checked against the original; missing dose/frequency is never guessed.
- Medicine schedules (daily/weekday/one-time, timezone and DST aware), dose logging (taken, skipped, not sure), undo, history, snooze.
- Reminder planning (idempotent keys, quiet hours, retries, honest delivery status) and the cron route that uses it.
- Appointments with preparation notes, questions and .ics export; timeline; search; health profile with sources and verification.
- Family profiles, caregiver grants (viewer/editor) with revoke, share links with expiry and revoke, doctor packet, JSON export, audit log, delete workspace.
- Assistant over saved records with source links; urgent-symptom guidance; refuses medicine-change advice; treats documents as data.
- Signed-in accounts saved in Supabase: phone OTP sign-up with password, password sign-in, every record type, original files in private storage, sync status with retry, sign out (this device or everywhere), email invitations that activate when the invited person signs in, share links stored as hashes and opened through a database function, and account deletion that removes files and data. Verified end to end against a local Supabase (docs/TESTING.md).
- Image OCR at upload (opt-in per upload, every value marked for review), browser push reminders per device, and a rate limiter shared across server instances.
- Supabase schema with RLS, storage policies and DB tests; security headers; PWA manifest and offline shell; English and Hindi strings for core UI.
- Responsive layout checked at 390 px and 1366 px.

## Needs your credentials (built, not exercised against the real service)

- Supabase project (auth, database, storage) — see docs/DEPLOYMENT.md.
- Anthropic API key for "Ask AI provider" explanations and image OCR.
- Resend (email), Twilio (SMS) and VAPID keys (browser push) for reminders; an SMS provider inside Supabase for sign-up codes; Google OAuth credentials for Google sign-in.
- Vercel Pro plan if reminders should run every 5 minutes.

## Not yet done

- Scanned PDFs (no text layer) are stored but not read automatically; image OCR covers photos.
- Retrieval with embeddings (`document_chunks.embedding` exists; the assistant uses keyword retrieval). Anthropic has no embeddings API, so this needs a separate embeddings provider.
- Assistant chat history isn't saved for signed-in accounts (kept for the session only).
- Offline editing for signed-in accounts: changes made offline are kept in memory and retried, but are lost if the tab is closed before reconnecting (the page warns).
- Multi-device editing is last-write-wins per record; two people editing the same record at once can overwrite each other.
- The app isn't hosted anywhere yet; it needs a Git repository and a Vercel project (docs/DEPLOYMENT.md).
- Hindi translation covers navigation and core labels only.
- Drug interaction checks are intentionally unavailable until a licensed data source is integrated.

## Needs clinical, legal or security review before real patients use it

- Glossary and general-information text (`src/lib/ai/glossary.ts`) by a clinician.
- Urgent-symptom phrases and guidance (`src/lib/ai/safety.ts`), localized emergency numbers.
- Privacy policy, terms, consent wording, and data-residency obligations (e.g. India DPDP Act, HIPAA if applicable).
- AI provider data-processing agreement and retention settings.
- Independent security review / penetration test of the Supabase policies and API routes.
- Accessibility audit with a screen reader.
