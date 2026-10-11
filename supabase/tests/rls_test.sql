-- Row-level security tests. Run by scripts/test-db.sh; any failed assertion aborts with an error.
\set ON_ERROR_STOP on
grant usage on schema public, auth, storage to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant usage on all sequences in schema public to authenticated;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('role', 'authenticated', false); end $$;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'ASSERTION FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;

-- User A creates a profile with a document and an observation.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into health_profiles (id, owner_id, display_name) values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'A');
insert into documents (id, profile_id, title, category, uploaded_by) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Report', 'lab_report', '00000000-0000-0000-0000-00000000000a');
insert into lab_observations (id, profile_id, document_id, test_name, test_key, value_text, value, unit, confidence) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'TSH', 'tsh', '2.1', 2.1, 'mIU/L', 0.96);
insert into observation_revisions (observation_id, value_text, source) values ('33333333-3333-3333-3333-333333333333', '2.1', 'extraction');
insert into storage.objects (bucket_id, name) values ('medical-documents', '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/1/report.pdf');
select pg_temp.assert((select count(*) from documents) = 1, 'owner can read own document');

-- User B cannot see or modify A's records.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from health_profiles) = 0, 'other user cannot see profile');
select pg_temp.assert((select count(*) from documents) = 0, 'other user cannot see documents');
select pg_temp.assert((select count(*) from lab_observations) = 0, 'other user cannot see observations');
select pg_temp.assert((select count(*) from storage.objects) = 0, 'other user cannot see stored files');
do $$ begin
  insert into documents (profile_id, title, category, uploaded_by) values ('11111111-1111-1111-1111-111111111111', 'x', 'other', '00000000-0000-0000-0000-00000000000b');
  raise exception 'ASSERTION FAILED: cross-user insert allowed';
exception when insufficient_privilege then raise notice 'ok - cross-user insert blocked'; end $$;
update documents set title = 'hacked';
delete from documents;
reset role;
select pg_temp.assert((select title from documents) = 'Report', 'cross-user update/delete had no effect');

-- A grants B viewer access.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into profile_access (profile_id, grantee_email, grantee_user_id, role, status, invited_by) values ('11111111-1111-1111-1111-111111111111', 'b@example.com', '00000000-0000-0000-0000-00000000000b', 'viewer', 'active', '00000000-0000-0000-0000-00000000000a');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from documents) = 1, 'viewer can read shared profile');
select pg_temp.assert((select count(*) from storage.objects) = 1, 'viewer can read shared files');
update lab_observations set value_text = '99';
reset role;
select pg_temp.assert((select value_text from lab_observations) = '2.1', 'viewer cannot edit');

-- Revision history is append-only.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
delete from observation_revisions;
update observation_revisions set value_text = 'x';
reset role;
select pg_temp.assert((select count(*) from observation_revisions where value_text = '2.1') = 1, 'revisions cannot be edited or deleted');

-- Revocation removes access immediately.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update profile_access set status = 'revoked', revoked_at = now();
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from documents) = 0, 'revoked user loses access');

-- Unauthenticated requests see nothing.
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
select pg_temp.assert((select count(*) from documents) = 0, 'no session sees nothing');
reset role;

-- Constraints.
do $$ begin
  insert into medication_schedules (medicine_id, times, start_date, timezone) values (gen_random_uuid(), '{25:00}', '2026-01-01', 'UTC');
  raise exception 'ASSERTION FAILED: invalid time accepted';
exception when check_violation or foreign_key_violation then raise notice 'ok - invalid dose time rejected'; end $$;
do $$ begin
  insert into notification_events (idempotency_key, occurrence_key, profile_id, user_id, channel, send_at, status) values ('k', 'o', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'email', now(), 'queued');
  insert into notification_events (idempotency_key, occurrence_key, profile_id, user_id, channel, send_at, status) values ('k', 'o', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'email', now(), 'queued');
  raise exception 'ASSERTION FAILED: duplicate reminder accepted';
exception when unique_violation then raise notice 'ok - duplicate reminder rejected'; end $$;
