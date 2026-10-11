-- HealthOS initial schema (PostgreSQL / Supabase).
-- Every medical record belongs to a health profile; access is enforced with
-- row-level security through can_access_profile(). Corrections never overwrite
-- original extractions (see observation_revisions).

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------------------------------------------------------------- accounts
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  language text not null default 'en',
  locale text not null default 'en-GB',
  timezone text not null default 'UTC',
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.health_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 120),
  preferred_name text,
  relationship text not null default 'self' check (relationship in ('self','child','parent','partner','other')),
  date_of_birth date,
  emergency_contact text,
  preferred_provider text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.health_profiles (owner_id);

create table public.profile_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  grantee_email text not null,
  grantee_user_id uuid references auth.users (id) on delete cascade,
  role text not null check (role in ('viewer','editor')),
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  invited_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (profile_id, grantee_email)
);
create index on public.profile_access (grantee_user_id) where status = 'active';

-- Owner, or an active grant. Editors can write; viewers can only read.
create or replace function public.can_access_profile(p uuid, need_edit boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from health_profiles hp where hp.id = p and hp.owner_id = auth.uid())
      or exists (
        select 1 from profile_access pa
        where pa.profile_id = p and pa.grantee_user_id = auth.uid() and pa.status = 'active'
          and (not need_edit or pa.role = 'editor'));
$$;

-- ---------------------------------------------------------------- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  title text not null,
  category text not null check (category in ('lab_report','prescription','consultation','discharge','imaging','vaccination','allergy','history','bill','other')),
  custom_category text,
  document_date date,
  provider text,
  tags text[] not null default '{}',
  notes text,
  status text not null default 'uploaded' check (status in ('uploaded','processing','needs_review','processed','failed')),
  error_message text,
  uploaded_by uuid not null references auth.users (id),
  uploaded_at timestamptz not null default now(),
  search tsvector
);
create index on public.documents (profile_id, document_date desc);
create index documents_search_idx on public.documents using gin (search);

-- Originals are immutable; a re-upload creates a new version.
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version int not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  sha256 text not null,
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','infected','error')),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create table public.document_pages (
  document_id uuid not null references public.documents (id) on delete cascade,
  page int not null,
  text text not null,
  method text not null check (method in ('text','pdf-text','docx','ocr','manual')),
  primary key (document_id, page)
);

create table public.extracted_fields (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  field_key text not null,
  original_text text not null,
  value text,
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  review_reasons text[] not null default '{}',
  verification text not null default 'extracted' check (verification in ('extracted','confirmed','corrected','manual')),
  page int,
  created_at timestamptz not null default now()
);
create index on public.extracted_fields (document_id);

create table public.lab_observations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  test_name text not null,
  test_key text not null,
  value_text text not null,
  value numeric,
  unit text,
  observed_on date,
  flag text check (flag in ('H','L')),
  page int,
  source_line text,
  confidence numeric(3,2) not null,
  review_reasons text[] not null default '{}',
  verification text not null default 'extracted' check (verification in ('extracted','confirmed','corrected','manual')),
  created_at timestamptz not null default now()
);
create index on public.lab_observations (profile_id, test_key, observed_on);

-- Reference interval exactly as printed on that report.
create table public.reference_intervals (
  observation_id uuid primary key references public.lab_observations (id) on delete cascade,
  text text not null,
  low numeric,
  high numeric
);

create table public.observation_revisions (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.lab_observations (id) on delete cascade,
  value_text text not null,
  unit text,
  ref_text text,
  source text not null check (source in ('extraction','user')),
  revised_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- medicines
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  prescriber text,
  prescribed_on date,
  notes text,
  status text not null default 'draft' check (status in ('draft','verified')),
  created_at timestamptz not null default now()
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  medicine_name text not null,
  brand_name text, active_ingredient text, strength text, dosage_form text, dose text, route text,
  frequency_text text, food_instruction text, duration_text text, instructions text, source_line text,
  confidence numeric(3,2) not null,
  review_reasons text[] not null default '{}',
  verified_by uuid references auth.users (id),
  verified_at timestamptz
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  prescription_id uuid references public.prescriptions (id) on delete set null,
  name text not null,
  strength text,
  dose text not null,
  route text,
  frequency_text text,
  instructions text,
  prescriber text,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default now()
);
create index on public.medicines (profile_id) where status = 'active';

create or replace function public.valid_dose_times(t text[]) returns boolean language sql immutable as $$
  select coalesce(bool_and(x ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), true) from unnest(t) x;
$$;

create table public.medication_schedules (
  medicine_id uuid primary key references public.medicines (id) on delete cascade,
  times text[] not null check (public.valid_dose_times(times)),
  weekdays smallint[] not null default '{}',
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  timezone text not null,
  one_time boolean not null default false
);

create table public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  occurrence_key text not null unique, -- medicine|date|time
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  medicine_id uuid references public.medicines (id) on delete set null,
  scheduled_for timestamptz not null,
  status text not null check (status in ('taken','skipped','unconfirmed')),
  taken_at timestamptz,
  note text,
  recorded_by uuid not null references auth.users (id),
  recorded_at timestamptz not null default now()
);
create index on public.dose_logs (profile_id, scheduled_for desc);

-- ---------------------------------------------------------------- appointments & profile entries
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  type text not null check (type in ('doctor','lab_test','follow_up','vaccination','prescription_review','other')),
  title text not null,
  starts_at timestamptz not null,
  provider text, location text, purpose text, preparation text,
  questions text[] not null default '{}',
  related_document_ids uuid[] not null default '{}',
  status text not null default 'upcoming' check (status in ('upcoming','completed','cancelled')),
  created_at timestamptz not null default now()
);
create index on public.appointments (profile_id, starts_at);

create table public.follow_up_reminders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  task text not null,
  due_at timestamptz,
  done_at timestamptz
);

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  substance text not null,
  reaction text,
  source text not null check (source in ('user','document','verified')),
  source_document_id uuid references public.documents (id) on delete set null,
  recorded_at timestamptz not null default now()
);

create table public.medical_history_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  kind text not null check (kind in ('condition','surgery','history','note')),
  text text not null,
  source text not null check (source in ('user','document','verified')),
  source_document_id uuid references public.documents (id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- AI
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  chunk_index int not null,
  page int,
  content text not null,
  embedding vector(1024),
  unique (document_id, chunk_index)
);

-- ---------------------------------------------------------------- sharing, notifications, jobs, audit
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  token_hash bytea not null unique, -- sha256 of the token; the token itself is never stored
  label text not null,
  document_ids uuid[] not null,
  include_medications boolean not null default false,
  include_appointments boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  channels text[] not null default '{browser}',
  quiet_start time, quiet_end time,
  snooze_minutes int not null default 10 check (snooze_minutes between 1 and 240),
  timezone text not null default 'UTC',
  email text, phone_e164 text
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  occurrence_key text not null,
  profile_id uuid not null references public.health_profiles (id) on delete cascade,
  medicine_id uuid references public.medicines (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('browser','email','sms')),
  send_at timestamptz not null,
  status text not null check (status in ('queued','sent','failed','held_quiet_hours')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index on public.notification_events (status, send_at);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ocr','explain','embed','export','email','cleanup')),
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  payload jsonb not null default '{}',
  attempts int not null default 0,
  max_attempts int not null default 3,
  safe_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.jobs (status, run_after);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  profile_id uuid references public.health_profiles (id) on delete set null,
  action text not null,
  detail text not null, -- never contains medical content
  created_at timestamptz not null default now()
);
create index on public.audit_logs (actor_id, created_at desc);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('terms','privacy','ai_processing','ocr_processing','sms','email')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- row-level security
alter table public.accounts enable row level security;
create policy "own account" on public.accounts for all using (id = auth.uid()) with check (id = auth.uid());

alter table public.health_profiles enable row level security;
create policy "read accessible profiles" on public.health_profiles for select using (public.can_access_profile(id));
create policy "owner writes profile" on public.health_profiles for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.profile_access enable row level security;
create policy "owner manages access" on public.profile_access for all
  using (exists (select 1 from public.health_profiles hp where hp.id = profile_id and hp.owner_id = auth.uid()))
  with check (exists (select 1 from public.health_profiles hp where hp.id = profile_id and hp.owner_id = auth.uid()));
create policy "grantee sees own grant" on public.profile_access for select using (grantee_user_id = auth.uid());

-- Tables keyed directly by profile_id.
do $$
declare t text;
begin
  foreach t in array array['documents','lab_observations','prescriptions','medicines','dose_logs','appointments','follow_up_reminders','allergies','medical_history_entries','ai_conversations','document_chunks','share_links','notification_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select using (public.can_access_profile(profile_id))', t);
    execute format('create policy "write %1$s" on public.%1$I for insert with check (public.can_access_profile(profile_id, true))', t);
    execute format('create policy "update %1$s" on public.%1$I for update using (public.can_access_profile(profile_id, true)) with check (public.can_access_profile(profile_id, true))', t);
    execute format('create policy "delete %1$s" on public.%1$I for delete using (public.can_access_profile(profile_id, true))', t);
  end loop;
end $$;

-- Tables reached through a parent row.
alter table public.document_versions enable row level security;
create policy "via document" on public.document_versions for all
  using (exists (select 1 from public.documents d where d.id = document_id and public.can_access_profile(d.profile_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.can_access_profile(d.profile_id, true)));
alter table public.document_pages enable row level security;
create policy "via document" on public.document_pages for all
  using (exists (select 1 from public.documents d where d.id = document_id and public.can_access_profile(d.profile_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.can_access_profile(d.profile_id, true)));
alter table public.extracted_fields enable row level security;
create policy "via document" on public.extracted_fields for all
  using (exists (select 1 from public.documents d where d.id = document_id and public.can_access_profile(d.profile_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.can_access_profile(d.profile_id, true)));
alter table public.reference_intervals enable row level security;
create policy "via observation" on public.reference_intervals for all
  using (exists (select 1 from public.lab_observations o where o.id = observation_id and public.can_access_profile(o.profile_id)))
  with check (exists (select 1 from public.lab_observations o where o.id = observation_id and public.can_access_profile(o.profile_id, true)));
alter table public.observation_revisions enable row level security;
create policy "read revisions" on public.observation_revisions for select
  using (exists (select 1 from public.lab_observations o where o.id = observation_id and public.can_access_profile(o.profile_id)));
create policy "append revisions" on public.observation_revisions for insert
  with check (exists (select 1 from public.lab_observations o where o.id = observation_id and public.can_access_profile(o.profile_id, true)));
-- No update/delete policy: revision history is append-only.
alter table public.prescription_items enable row level security;
create policy "via prescription" on public.prescription_items for all
  using (exists (select 1 from public.prescriptions p where p.id = prescription_id and public.can_access_profile(p.profile_id)))
  with check (exists (select 1 from public.prescriptions p where p.id = prescription_id and public.can_access_profile(p.profile_id, true)));
alter table public.medication_schedules enable row level security;
create policy "via medicine" on public.medication_schedules for all
  using (exists (select 1 from public.medicines m where m.id = medicine_id and public.can_access_profile(m.profile_id)))
  with check (exists (select 1 from public.medicines m where m.id = medicine_id and public.can_access_profile(m.profile_id, true)));
alter table public.ai_messages enable row level security;
create policy "own conversation" on public.ai_messages for all
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

alter table public.notification_preferences enable row level security;
create policy "own prefs" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.push_subscriptions enable row level security;
create policy "own push" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.consent_records enable row level security;
create policy "own consent read" on public.consent_records for select using (user_id = auth.uid());
create policy "own consent add" on public.consent_records for insert with check (user_id = auth.uid());
alter table public.audit_logs enable row level security;
create policy "own audit" on public.audit_logs for select using (actor_id = auth.uid() or public.can_access_profile(profile_id));
-- jobs: service role only (no policies => no client access).
alter table public.jobs enable row level security;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit)
values ('medical-documents', 'medical-documents', false, 20971520)
on conflict (id) do nothing;

-- Object paths are "<profile_id>/<document_id>/<version>/<file>".
create policy "read own profile files" on storage.objects for select
  using (bucket_id = 'medical-documents' and public.can_access_profile(((storage.foldername(name))[1])::uuid));
create policy "upload to editable profile" on storage.objects for insert
  with check (bucket_id = 'medical-documents' and public.can_access_profile(((storage.foldername(name))[1])::uuid, true));
-- No update policy: originals are immutable.
create policy "delete from editable profile" on storage.objects for delete
  using (bucket_id = 'medical-documents' and public.can_access_profile(((storage.foldername(name))[1])::uuid, true));

-- ---------------------------------------------------------------- search
create or replace function public.documents_search_update() returns trigger language plpgsql as $$
begin
  new.search := to_tsvector('simple', coalesce(new.title,'') || ' ' || coalesce(new.provider,'') || ' ' || array_to_string(new.tags, ' ') || ' ' || coalesce(new.notes,''));
  return new;
end $$;
create trigger documents_search before insert or update on public.documents for each row execute function public.documents_search_update();
