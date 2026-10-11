-- Columns and functions used by the signed-in app's sync layer (src/lib/cloud).

alter table public.accounts
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists keep_assistant_history boolean not null default false;

alter table public.prescription_items add column if not exists times text[] check (times is null or public.valid_dose_times(times));
alter table public.prescription_items add column if not exists verified boolean not null default false;
alter table public.dose_logs add column if not exists snoozed_until timestamptz;
alter table public.document_versions alter column sha256 drop not null;

-- The app records its own audit trail (details never contain medical content).
create policy "append own audit" on public.audit_logs for insert
  with check (actor_id = auth.uid() and (profile_id is null or public.can_access_profile(profile_id)));
alter table public.audit_logs add column if not exists client_id uuid unique;

-- Invitations are made by email. When the invited person signs in, their
-- pending grants are linked to their account and become active.
create or replace function public.accept_pending_grants() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update profile_access pa
     set grantee_user_id = auth.uid(), status = 'active', accepted_at = now()
   where pa.status = 'pending'
     and lower(pa.grantee_email) = lower((select email from auth.users where id = auth.uid()));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.accept_pending_grants() from public;
grant execute on function public.accept_pending_grants() to authenticated;

-- Read-only bundle for a share link. Callers send the raw token from the URL
-- fragment; only its SHA-256 is stored. Returns null for unknown, expired or
-- revoked links, without saying which.
create or replace function public.shared_packet(token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l share_links;
begin
  if token is null or length(token) < 32 then return null; end if;
  select * into l from share_links where token_hash = sha256(convert_to(token, 'UTF8'));
  if not found or l.revoked_at is not null or l.expires_at <= now() then return null; end if;
  return jsonb_build_object(
    'link', jsonb_build_object('id', l.id, 'profile_id', l.profile_id, 'label', l.label, 'document_ids', l.document_ids,
                               'include_medications', l.include_medications, 'include_appointments', l.include_appointments, 'expires_at', l.expires_at),
    'health_profiles', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'owner_id', null, 'display_name', display_name, 'relationship', relationship, 'date_of_birth', date_of_birth, 'created_at', created_at)), '[]') from health_profiles where id = l.profile_id),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d) - 'search' - 'uploaded_by' - 'notes'), '[]') from documents d where d.profile_id = l.profile_id and d.id = any(l.document_ids)),
    'document_pages', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from document_pages p where p.document_id = any(l.document_ids)),
    'lab_observations', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from lab_observations o where o.profile_id = l.profile_id and o.document_id = any(l.document_ids)),
    'reference_intervals', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from reference_intervals r join lab_observations o on o.id = r.observation_id where o.profile_id = l.profile_id and o.document_id = any(l.document_ids)),
    'medicines', case when l.include_medications then (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from medicines m where m.profile_id = l.profile_id and m.status = 'active') else '[]' end,
    'medication_schedules', case when l.include_medications then (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from medication_schedules s join medicines m on m.id = s.medicine_id where m.profile_id = l.profile_id and m.status = 'active') else '[]' end,
    'appointments', case when l.include_appointments then (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from appointments a where a.profile_id = l.profile_id) else '[]' end
  );
end $$;
revoke all on function public.shared_packet(text) from public;
grant execute on function public.shared_packet(text) to anon, authenticated;

-- Keep list order stable for items that have no natural ordering column.
alter table public.prescription_items add column if not exists position int not null default 0;
alter table public.follow_up_reminders add column if not exists position int not null default 0;

-- Deleting an account must not be blocked by records it created in profiles
-- shared with it (those belong to the profile owner and stay).
do $$
declare r record;
begin
  for r in select * from (values
    ('documents', 'uploaded_by'), ('dose_logs', 'recorded_by'), ('share_links', 'created_by'),
    ('profile_access', 'invited_by'), ('observation_revisions', 'revised_by'), ('prescription_items', 'verified_by')) as t(tbl, col)
  loop
    execute format('alter table public.%I alter column %I drop not null', r.tbl, r.col);
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null', r.tbl, r.tbl || '_' || r.col || '_fkey', r.col);
  end loop;
end $$;

-- Shared fixed-window rate limiter for server routes (all instances see the same counts).
create table if not exists public.rate_limits (
  key text primary key,
  count int not null,
  reset_at timestamptz not null
);
alter table public.rate_limits enable row level security; -- no policies: service role only

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns int language plpgsql security definer set search_path = public as $$
declare r rate_limits;
begin
  insert into rate_limits as rl (key, count, reset_at) values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count = case when rl.reset_at <= now() then 1 else rl.count + 1 end,
    reset_at = case when rl.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else rl.reset_at end
  returning * into r;
  -- Seconds to wait, or 0 when the request is allowed.
  return case when r.count > p_limit then greatest(1, ceil(extract(epoch from r.reset_at - now()))::int) else 0 end;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
