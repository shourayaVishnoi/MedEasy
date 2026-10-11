# HealthOS

A calm, private place for personal medical records: lab reports, prescriptions,
medicines, reminders and appointments, with plain-language explanations that are
grounded in the user's own documents. Built from the *HealthOS Master Build Prompt*.

> HealthOS helps people organize and understand their information. It is **not a
> medical device**, does not diagnose, and never starts, stops or changes a medicine.

## Try it in 1 minute

```bash
npm install
npm run dev          # http://localhost:3000
```

Open **/demo**. It loads fictional people ("Alex Sample", "Mira Sample") and
synthetic records into your browser only (localStorage + IndexedDB). No account,
keys or network services are needed.

With Supabase configured (`.env.example`), people sign up with their phone number
(or Google) and their records are saved to their account: every change is written
to Postgres under row-level security and original files go to a private bucket.

## What's in the box

| Area | Where |
| --- | --- |
| Landing, demo entry, auth screens (phone OTP, Google, password, reset) | `src/app/page.tsx`, `src/app/demo`, `src/app/auth`, `src/components/AuthForms.tsx` |
| Dashboard, records vault, upload, report explainer and result review | `src/app/app/*`, `src/components/ReportViews.tsx` |
| Prescription verification → medicine schedule → dose tracking | `src/components/PrescriptionReview.tsx`, `MedicineForm.tsx`, `DoseList.tsx`, `src/lib/meds` |
| Compare results over time (same test **and** unit only) | `src/app/app/compare`, `src/lib/reports/compare.ts` |
| Assistant grounded in saved records, with citations | `src/app/app/assistant`, `src/lib/ai/assistant.ts`, `src/lib/ai/safety.ts` |
| Health profile, family profiles and caregiver grants, timeline, search | `src/app/app/profile`, `timeline`, `search` |
| Share links (unguessable token, expiry, revocation), export, privacy, audit log | `src/app/app/share`, `src/app/shared`, `src/app/app/privacy` |
| Extraction (lab and prescription parsers with confidence and review reasons) | `src/lib/extraction` |
| Signed-in sync with Supabase (load, minimal diffs, retries, files) | `src/lib/cloud/tables.ts`, `src/lib/cloud/sync.ts` |
| Server routes: AI explain, OCR, reminder cron (email, SMS, Web Push), account deletion, health check | `src/app/api/*`, `src/lib/server/*` |
| Supabase schema, RLS, storage policies, DB tests | `supabase/migrations/0001_init.sql`, `supabase/tests`, `scripts/test-db.sh` |
| PWA (manifest, offline shell), English and Hindi strings | `public/`, `src/lib/i18n` |

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase (Auth, Postgres, private Storage) · Vercel (hosting + Cron) ·
Anthropic API (optional) · Resend / Twilio (optional) · Vitest.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (parsers, schedules, reminders, comparison, explainer, assistant safety, share links, ingest, cloud mapping) |
| `npm run test:db` | Applies the migrations to a throwaway local Postgres, checks RLS, and runs the sync layer against it (needs PostgreSQL 15+ binaries) |
| `npm run test:e2e` | Browser test of a real account against a local Supabase (see docs/TESTING.md) |

## Configuration

Copy `.env.example` to `.env.local`. Every key is optional; each one turns on a
feature. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Supabase, Google
sign-in, phone OTP, AI, email/SMS and Vercel setup.

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): deploying to Vercel and setting up each external service
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit, data model, safety design
- [docs/TESTING.md](docs/TESTING.md): what is tested, how to run it, troubleshooting
- [RELEASE_READINESS.md](RELEASE_READINESS.md): honest status — implemented, tested, needs credentials, not yet done, needs clinical/legal review
