# Deploying HealthOS

HealthOS runs on **Vercel** with **Supabase** for auth, database and private file
storage. Every external service is optional: without any keys the site runs the
browser-only demo.

## 1. Supabase

1. Create a project at supabase.com (pick a region close to your users).
2. **Database:** run every file in `supabase/migrations/` in order (`0001_init.sql`, then
   `0002_cloud_sync.sql`), either in the *SQL Editor* or with `supabase link` + `supabase db push`.
   They create all tables, row-level security, the private `medical-documents` storage bucket and
   its policies, the share-link and invitation functions, and the shared rate limiter.
   It needs the `vector` extension (enabled by the migration; available on all Supabase plans).
3. **Keys:** *Project Settings → API*: copy the project URL and `anon` key into
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the
   `service_role` key into `SUPABASE_SERVICE_ROLE_KEY` (server only; used by the reminder job).
4. **Auth → URL configuration:** set *Site URL* to your production URL and add
   `https://<your-domain>/auth/callback` (plus `http://localhost:3000/auth/callback` for development) to *Redirect URLs*.
5. **Phone OTP:** *Auth → Providers → Phone*: enable it and connect an SMS
   provider (Twilio, MessageBird, Vonage or Textlocal). Supabase sends the codes;
   HealthOS enforces a 60 s resend cooldown and attempt limits in the UI. Set rate
   limits under *Auth → Rate Limits*.
6. **Google:** create an OAuth client in Google Cloud Console (type *Web*), add the
   Supabase callback `https://<project-ref>.supabase.co/auth/v1/callback` as an
   authorized redirect URI, then paste the client ID/secret into *Auth → Providers → Google*.
7. **Password policy:** *Auth → Providers → Email/Password*: minimum length 10 and
   leaked-password protection on. The sign-up form enforces the same rules client-side.

## 2. Vercel

1. Push this folder to a Git repository and import it in Vercel (framework: Next.js, no overrides needed).
2. Add environment variables from `.env.example` under *Settings → Environment Variables* (Production and Preview).
   Set `NEXT_PUBLIC_APP_URL` to the deployed URL.
3. Deploy. `/api/health` returns which features are configured (booleans only, never values).
4. **Cron:** `vercel.json` schedules `/api/cron/reminders` once a day (08:00 UTC), because the
   free Hobby plan rejects anything more frequent. Set `CRON_SECRET`; Vercel sends it as a bearer
   token. For timely dose reminders, call the endpoint every 5 minutes from a free scheduler such
   as cron-job.org (GET, header `Authorization: Bearer <CRON_SECRET>`), or upgrade to Vercel Pro
   and set the schedule back to `*/5 * * * *`.

## 3. Optional services

| Feature | Variables | Notes |
| --- | --- | --- |
| AI explanations ("Ask AI provider") and image OCR | `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_ALLOW_ANONYMOUS` | Image OCR runs at upload only when the user ticks "Read text from photos". Requests are rate limited per IP (shared across instances through the database) and, when Supabase is configured, require sign-in unless `AI_ALLOW_ANONYMOUS=true`. Document text is wrapped as untrusted data; the system prompt forbids diagnosis and medicine changes. Review the provider's data-retention terms before launch. |
| Browser push reminders | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Generate keys once with `npx web-push generate-vapid-keys`. Users turn notifications on per device in *Settings*. On iPhone/iPad, push works only after adding the site to the Home Screen. |
| Email reminders | `RESEND_API_KEY`, `EMAIL_FROM` | Verify the sending domain in Resend. Messages contain no medicine names or health details. |
| SMS reminders | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Register the sender as your country requires (e.g. DLT in India, 10DLC in the US). |
| Brand | `NEXT_PUBLIC_BRAND_NAME` | Defaults to "HealthOS". |

## 4. After deploying

- Run through `RELEASE_READINESS.md`.
- Check security headers with securityheaders.com and that `/api/*` and `/app/*` responses are `Cache-Control: private, no-store`.
- Confirm storage objects can't be fetched without a signed URL.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Sign-in page says auth isn't configured | `NEXT_PUBLIC_SUPABASE_*` missing at **build** time (public vars are inlined; redeploy after adding) |
| Google sign-in returns to an error page | Redirect URL not in Supabase allow-list, or Google OAuth redirect URI mismatch |
| OTP never arrives | Phone provider not enabled in Supabase, or SMS sender not registered for that country |
| Cron returns 401 | `CRON_SECRET` not set or differs between Vercel and the request |
| Cron returns 503 | `SUPABASE_SERVICE_ROLE_KEY` missing |
| "AI service unavailable" | Missing/invalid `ANTHROPIC_API_KEY`, or provider rate limit |
