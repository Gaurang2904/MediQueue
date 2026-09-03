-- =====================================================================================
-- MediQueue — consolidated Supabase schema + security migration
-- =====================================================================================
-- Run this whole file in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- This file supersedes every previous fragmented/append-only version of this schema.
-- It is IDEMPOTENT and SAFE TO RE-RUN at any time, against either a brand-new project
-- or an existing database with real data — it never drops a table, and every object it
-- creates uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS so re-running it
-- converges on the same end state instead of erroring on "already exists."
--
-- Prerequisite (one-time, outside this file): Supabase Dashboard → Authentication →
-- Sign In / Providers → Third-Party Auth → Add provider → Firebase, using your Firebase
-- project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID). This is what lets auth.jwt() below
-- understand Firebase ID tokens — without it every request from the app fails with a
-- JWT verification error.
--
-- Roles modeled here (see README.md for the full picture):
--   Patient           — self-service signup, own records only.
--   Doctor            — owns their own clinic: appointments, consultations, payments,
--                        profile, and (optionally) Registration Desk staff accounts.
--   Registration Desk — OPTIONAL, doctor-owned front-desk role. Payment verification
--                        and patient status tracking for exactly one doctor's clinic.
--                        Never sees consultations/diagnoses/prescriptions, never edits
--                        a doctor's profile, never manages other staff. A clinic that
--                        never creates one behaves exactly as if this role didn't exist.
-- =====================================================================================


-- =====================================================================================
-- 1. TABLES
-- =====================================================================================

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  name text not null,
  clinic_name text,
  email text unique,
  qr_code_url text,
  consultation_fee numeric not null default 500,
  status text not null default 'Available',
  slot_config jsonb not null default '{"startTime":"09:00","endTime":"13:00","durationMinutes":20,"capacityPerSlot":1}',
  qualification text,
  specialization text,
  available_days text[] not null default '{}',
  clinic_address text,
  phone text,
  gstin text,
  created_at timestamptz not null default now()
);

-- Safety net for a database that already had `doctors` before profile fields existed.
alter table public.doctors
  add column if not exists clinic_name text,
  add column if not exists qualification text,
  add column if not exists specialization text,
  add column if not exists available_days text[] not null default '{}',
  add column if not exists clinic_address text,
  add column if not exists phone text,
  add column if not exists gstin text;

-- New doctor profiles start at ₹500; existing saved fees remain unchanged.
alter table public.doctors
  alter column consultation_fee set default 500;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  email text,
  photo_data_url text,
  name text not null,
  address text,
  contact text unique not null,
  age int,
  gender text,
  blood_group text,
  mobility text,
  past_disease_history boolean not null default false,
  past_disease_details text,
  allergies boolean not null default false,
  allergy_details text,
  dietary_restrictions boolean not null default false,
  vitals jsonb not null default '{}',
  registered_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  date date not null,
  illness text,
  slot text,
  is_walk_in boolean not null default false,
  queue_number int not null,
  payment_mode text,
  status text not null default 'waiting',
  created_at timestamptz not null default now()
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.visits(id) on delete cascade,
  symptoms text,
  findings text,
  diagnosis_notes text,
  clinic_medicines jsonb not null default '[]',
  outside_medicines jsonb not null default '[]',
  follow_up text,
  lifestyle_advice text,
  precautions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Kept as a separate ALTER so existing MediQueue projects receive this column when
-- the idempotent setup script is re-run.
alter table public.consultations
  add column if not exists required_tests jsonb not null default '[]',
  add column if not exists additional_billing jsonb not null default '[]';

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.visits(id) on delete cascade,
  amount numeric not null default 0,
  mode text,
  status text not null default 'pending',
  screenshot_data_url text,
  bill_snapshot jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists bill_snapshot jsonb;

-- Registration Desk: optional, doctor-owned front-desk accounts. Created/managed
-- entirely from Doctor Dashboard → Staff (see netlify/functions/staff-*.js for the
-- Firebase Auth side) — there is no self-registration page for this role.
create table if not exists public.registration_staff (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  doctor_id uuid references public.doctors(id) on delete cascade,
  name text not null,
  email text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Safety net for a database that already had `registration_staff` before doctor
-- ownership existed.
alter table public.registration_staff
  add column if not exists doctor_id uuid references public.doctors(id) on delete cascade,
  add column if not exists active boolean not null default true;

-- Minimal forensic trail for security-sensitive actions (patient creation by staff,
-- visit creation by staff, account linking, payment verification). Deliberately no
-- RLS policy and no GRANT to `authenticated` at all below -- this table is completely
-- unreachable via the PostgREST API (not even SELECT), on purpose: it's readable only
-- from the Supabase dashboard/service role. Only log_audit_event() (security definer)
-- can ever write to it. See README/CLAUDE notes for why this stays intentionally
-- small rather than a general audit system.
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_firebase_uid text,
  actor_role text,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);


-- =====================================================================================
-- 2. INDEXES
-- =====================================================================================
-- Foreign keys are not indexed automatically by Postgres. These cover every hot lookup
-- path in lib/db.js (slots, dashboard, queue status, history, transactions, staff list).

create index if not exists visits_doctor_date_idx on public.visits (doctor_id, date);
create index if not exists visits_patient_id_idx on public.visits (patient_id);
create index if not exists registration_staff_doctor_id_idx on public.registration_staff (doctor_id);


-- =====================================================================================
-- 3. FUNCTIONS
-- =====================================================================================

-- ---------- Obsolete functions (superseded — dropped before anything is recreated) ---
-- Dropping these before the Policies section (which no longer references them) avoids
-- any "cannot drop function, other objects depend on it" error on a database that still
-- has an old policy pointing at one of them.
drop function if exists public.update_patient_blood_pressure(uuid, int, int);
drop function if exists public.is_registration();

-- ---------- Identity helpers ----------

create or replace function public.current_firebase_uid() returns text
language sql stable as $$ select nullif(auth.jwt()->>'sub', '') $$;

create or replace function public.is_doctor() returns boolean
language sql stable as $$
  select exists (select 1 from public.doctors d where d.firebase_uid = public.current_firebase_uid())
$$;

-- Returns the calling registration desk staff member's doctor_id, or null if the
-- caller isn't an *active* registration_staff row. This is what scopes every
-- registration-desk read/write to exactly one clinic, and what makes deactivating an
-- account cut off access immediately (independent of Firebase token expiry).
create or replace function public.current_registration_doctor_id() returns uuid
language sql stable as $$
  select r.doctor_id from public.registration_staff r
  where r.firebase_uid = public.current_firebase_uid() and r.active
$$;

-- Used only by the patients_select_registration policy below. Marked security definer
-- (like the privileged-write functions further down) so this internal visits lookup
-- runs with the function owner's privileges and bypasses visits' own RLS -- without
-- this, evaluating a patients SELECT would query visits, which itself queries patients
-- (see visits_select), producing "infinite recursion detected in policy for relation
-- patients". This does not change who can see what: the predicate is identical to the
-- inline check it replaces, only how it's evaluated changes.
create or replace function public.patient_has_visit_with_registration_doctor(p_patient_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.visits v
    where v.patient_id = p_patient_id
      and v.doctor_id = public.current_registration_doctor_id()
  )
$$;

-- ---------- Audit logging ----------
-- Internal-only: writes one row to audit_log, tagging the actor's uid/role by
-- re-deriving them the same way every other check in this file does (never trusts a
-- caller-supplied identity). Not directly callable by clients (revoked from PUBLIC
-- below) -- every caller of this is itself a trusted security-definer function that
-- has already performed its own authorization check before reaching this call, so
-- this never becomes a way to forge an audit entry for an action that didn't happen.
create or replace function public.log_audit_event(
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_firebase_uid, actor_role, action, target_table, target_id, details)
  values (
    public.current_firebase_uid(),
    case
      when public.is_doctor() then 'doctor'
      when public.current_registration_doctor_id() is not null then 'registration_staff'
      else 'patient'
    end,
    p_action, p_target_table, p_target_id, coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.log_audit_event(text, text, uuid, jsonb) from public;

-- ---------- Doctor-only privileged writes ----------

-- Doctors record height/weight/BP during a consultation, but shouldn't get a blanket
-- ability to overwrite a patient's other fields (name, contact, allergies, etc). This
-- is the only doctor write path onto `patients`, and it only ever touches vitals.*.
-- Only the fields actually passed in are patched, so e.g. submitting weight/height
-- alone doesn't blank out an existing BP reading.
create or replace function public.update_patient_vitals(
  p_patient_id uuid,
  p_weight numeric,
  p_height numeric,
  p_bp_systolic int,
  p_bp_diastolic int
) returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.patients;
  patch jsonb := '{}'::jsonb;
begin
  if not public.is_doctor() then
    raise exception 'Only doctors can record vitals.';
  end if;

  if p_weight is not null then
    patch := patch || jsonb_build_object('weight', p_weight);
  end if;
  if p_height is not null then
    patch := patch || jsonb_build_object('height', p_height);
  end if;
  if p_bp_systolic is not null then
    patch := patch || jsonb_build_object('bpSystolic', p_bp_systolic);
  end if;
  if p_bp_diastolic is not null then
    patch := patch || jsonb_build_object('bpDiastolic', p_bp_diastolic);
  end if;

  update public.patients
  set vitals = vitals || patch
  where id = p_patient_id
  returning * into updated_row;

  return updated_row;
end;
$$;

-- Lets a doctor or an active registration desk staff member register a patient from
-- their own portal instead of the patient self-registering. This is the only doctor/
-- staff insert path onto `patients` -- RLS's patients_insert_own policy only allows a
-- patient to insert their own row (firebase_uid = caller's uid), so this function
-- bypasses that policy deliberately (security definer) but re-implements the same
-- kind of explicit authorization check every other privileged function here uses.
-- Deliberately never accepts a firebase_uid: a staff/doctor-registered patient gets no
-- portal login (same as a front-desk walk-in record) -- letting a doctor/staff member
-- link an arbitrary firebase_uid to a patient row here would let them grant login
-- access (and therefore write access, e.g. self-verifying their own payments) to any
-- patient account, which is well beyond "can register a patient".
create or replace function public.create_patient_by_staff(
  p_email text,
  p_photo_data_url text,
  p_name text,
  p_address text,
  p_contact text,
  p_age int,
  p_gender text,
  p_blood_group text,
  p_mobility text,
  p_past_disease_history boolean,
  p_past_disease_details text,
  p_allergies boolean,
  p_allergy_details text,
  p_dietary_restrictions boolean,
  p_weight numeric,
  p_height numeric
) returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.patients;
begin
  if not (public.is_doctor() or public.current_registration_doctor_id() is not null) then
    raise exception 'Only doctors or registration desk staff can register a patient.';
  end if;

  insert into public.patients (
    firebase_uid, email, photo_data_url, name, address, contact, age, gender,
    blood_group, mobility, past_disease_history, past_disease_details, allergies,
    allergy_details, dietary_restrictions, vitals
  ) values (
    null, p_email, p_photo_data_url, p_name, p_address, p_contact, p_age, p_gender,
    p_blood_group, p_mobility, coalesce(p_past_disease_history, false), p_past_disease_details,
    coalesce(p_allergies, false), p_allergy_details, coalesce(p_dietary_restrictions, false),
    jsonb_build_object('weight', p_weight, 'height', p_height, 'bpSystolic', null, 'bpDiastolic', null)
  )
  returning * into new_row;

  perform public.log_audit_event('create_patient_by_staff', 'patients', new_row.id, jsonb_build_object('contact', new_row.contact));

  return new_row;
end;
$$;

-- ---------- Patient lookup / contact normalization ----------

-- Shared normalization so a search box, a freshly-typed 10-digit form field, and a
-- number stored with stray formatting all compare equal: strips everything but
-- digits, keeps the last 10. Mirrors the client-side normalization in lib/phone.js.
create or replace function public.normalize_contact(p_contact text) returns text
language sql immutable as $$
  select right(regexp_replace(coalesce(p_contact, ''), '\D', '', 'g'), 10)
$$;

-- Lets a doctor or active registration desk staff member search for an existing
-- patient by contact number before registering a new one (the "search existing
-- patient by mobile number" step of the walk-in workflow). Returns only identity
-- fields needed to disambiguate -- never medical history, address, or photo -- both
-- to avoid handing registration desk more than the app already intentionally limits
-- them to (see patients_select_registration/getRegistrationQueue) and because a
-- doctor doesn't need the full record just to decide "is this the same patient".
-- Returns zero rows (not an error) for an unauthorized caller, matching the existing
-- read-helper convention (patient_has_visit_with_registration_doctor above) --
-- RAISE EXCEPTION is reserved for the write RPCs in this file.
create or replace function public.find_patient_by_contact(p_contact text)
returns table(id uuid, name text, age int, gender text, contact text, blood_group text, has_login boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.age, p.gender, p.contact, p.blood_group, (p.firebase_uid is not null) as has_login
  from public.patients p
  where public.normalize_contact(p.contact) = public.normalize_contact(p_contact)
    and (public.is_doctor() or public.current_registration_doctor_id() is not null)
$$;

-- ---------- Visit booking ----------

-- Internal booking core shared by create_visit (patient-self) and
-- create_visit_by_staff (doctor/registration-desk booking on a patient's behalf) --
-- atomic check-then-insert serialized by an advisory lock keyed on (doctor_id, date),
-- so two concurrent booking requests for the same doctor's day (from either entry
-- point) can't race each other into double-booking a slot or handing out a duplicate
-- queue_number. Also guards against the same patient getting two simultaneous active
-- (non-cancelled) visits for the same doctor/date/slot -- the "double-click" case.
-- NOT directly callable by clients (revoked from PUBLIC below): it performs no
-- caller-identity check at all, trusting its two callers to have already verified the
-- caller is allowed to book for p_patient_id/p_doctor_id before reaching here.
create or replace function public._book_visit(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_date date,
  p_illness text,
  p_slot text,
  p_is_walk_in boolean,
  p_payment_mode text
) returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_booked_slot int;
  v_queue_number int;
  new_visit public.visits;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_doctor_id::text || p_date::text, 0));

  if exists (
    select 1 from public.visits v
    where v.patient_id = p_patient_id
      and v.doctor_id = p_doctor_id
      and v.date = p_date
      and v.slot is not distinct from p_slot
      and v.status <> 'cancelled'
  ) then
    raise exception 'This patient already has a visit booked for this slot.';
  end if;

  select (d.slot_config->>'capacityPerSlot')::int into v_capacity
  from public.doctors d
  where d.id = p_doctor_id;

  if v_capacity is null then
    raise exception 'Doctor not found.';
  end if;

  select count(*) into v_booked_slot
  from public.visits v
  where v.doctor_id = p_doctor_id
    and v.date = p_date
    and v.slot = p_slot
    and v.status <> 'cancelled';

  if v_booked_slot >= v_capacity then
    raise exception 'This slot is fully booked. Please choose another slot.';
  end if;

  select count(*) into v_queue_number
  from public.visits v
  where v.doctor_id = p_doctor_id
    and v.date = p_date
    and v.status <> 'cancelled';

  insert into public.visits (patient_id, doctor_id, date, illness, slot, is_walk_in, queue_number, payment_mode, status)
  values (p_patient_id, p_doctor_id, p_date, p_illness, p_slot, coalesce(p_is_walk_in, false), v_queue_number + 1, p_payment_mode, 'waiting')
  returning * into new_visit;

  return new_visit;
end;
$$;

revoke execute on function public._book_visit(uuid, uuid, date, text, text, boolean, text) from public;

-- Patient-self booking (unchanged behavior/signature from before -- still the only
-- entry point patients themselves use). Authorization check stays here; the actual
-- booking work now lives in _book_visit so create_visit_by_staff below doesn't
-- duplicate it.
create or replace function public.create_visit(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_date date,
  p_illness text,
  p_slot text,
  p_is_walk_in boolean,
  p_payment_mode text
) returns public.visits
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.patients p
    where p.id = p_patient_id and p.firebase_uid = public.current_firebase_uid()
  ) then
    raise exception 'You can only book visits for your own patient record.';
  end if;

  return public._book_visit(p_patient_id, p_doctor_id, p_date, p_illness, p_slot, p_is_walk_in, p_payment_mode);
end;
$$;

-- Doctor/registration-desk booking a visit on a patient's behalf (walk-in workflow).
-- p_doctor_id must be the caller's own doctor id (if a doctor) or their own
-- registration desk's doctor id (if staff) -- a staff account for one clinic can
-- never book a visit against another clinic's doctor, even by guessing ids.
create or replace function public.create_visit_by_staff(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_date date,
  p_illness text,
  p_slot text,
  p_is_walk_in boolean,
  p_payment_mode text
) returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  new_visit public.visits;
begin
  if not (
    exists (select 1 from public.doctors d where d.id = p_doctor_id and d.firebase_uid = public.current_firebase_uid())
    or public.current_registration_doctor_id() = p_doctor_id
  ) then
    raise exception 'You can only create visits for your own clinic.';
  end if;

  if not exists (select 1 from public.patients p where p.id = p_patient_id) then
    raise exception 'Patient not found.';
  end if;

  new_visit := public._book_visit(p_patient_id, p_doctor_id, p_date, p_illness, p_slot, p_is_walk_in, p_payment_mode);

  perform public.log_audit_event(
    'create_visit_by_staff', 'visits', new_visit.id,
    jsonb_build_object('patient_id', p_patient_id, 'doctor_id', p_doctor_id, 'queue_number', new_visit.queue_number)
  );

  return new_visit;
end;
$$;

-- ---------- Account linking ----------

-- Links an existing walk-in patient record (firebase_uid currently NULL) to a
-- Firebase account -- doctor/staff-authorized "staff-assisted" linking, never
-- self-service by the patient and never phone/OTP-based. The `firebase_uid is null`
-- condition in the UPDATE's WHERE clause is what makes this safe from hijacking: it
-- can only ever attach a login to a record that doesn't already have one, so it can
-- never take over an already-linked (and therefore already-someone's) patient
-- account. Pair this only with a firebase_uid that was JUST created for this specific
-- purpose (see netlify/functions/patient-create.js) -- never with a caller-typed uid
-- of unknown origin.
create or replace function public.link_patient_firebase_uid(p_patient_id uuid, p_firebase_uid text) returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.patients;
begin
  if not (public.is_doctor() or public.current_registration_doctor_id() is not null) then
    raise exception 'Only doctors or registration desk staff can link a patient account.';
  end if;
  if p_firebase_uid is null or length(trim(p_firebase_uid)) = 0 then
    raise exception 'A Firebase account is required to link.';
  end if;

  update public.patients
  set firebase_uid = p_firebase_uid
  where id = p_patient_id
    and firebase_uid is null
  returning * into updated_row;

  if updated_row is null then
    raise exception 'Patient not found, or this patient already has a linked account.';
  end if;

  perform public.log_audit_event('link_patient_firebase_uid', 'patients', updated_row.id, '{}'::jsonb);

  return updated_row;
end;
$$;

-- ---------- Registration desk read helper ----------

-- Column-minimized patient lookup for the registration dashboard (Payment
-- Verification / Patient Tracking) -- returns only id/name/contact, mirroring what
-- lib/db.js's getRegistrationQueue has always selected by app-layer convention, now
-- enforced at the database level too instead of relying solely on the client only
-- ever asking for those columns. Re-checks the same visibility rule patients_select
-- already grants (is_doctor() or an existing visit under the caller's own
-- registration-desk clinic) rather than trusting the id list blindly, so calling this
-- directly with an arbitrary id array can't surface more than the caller could
-- already see.
create or replace function public.get_registration_queue_patients(p_ids uuid[])
returns table(id uuid, name text, contact text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.contact
  from public.patients p
  where p.id = any(p_ids)
    and (public.is_doctor() or public.patient_has_visit_with_registration_doctor(p.id))
$$;

-- ---------- Registration Desk privileged writes ----------
-- Both functions below check current_registration_doctor_id() (null unless the caller
-- is an active registration_staff row) and additionally verify the target visit
-- belongs to that same doctor — a staff account can never touch another clinic's data,
-- even by guessing a visit id.

-- Registration desk can only ever move a visit between waiting and in-consultation —
-- never to awaiting-payment/completed/cancelled, which stay exclusively driven by
-- completeConsultation() and payment verification, so a status can never exist without
-- the record behind it.
create or replace function public.registration_set_visit_status(p_visit_id uuid, p_status text) returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.visits;
  v_current_status text;
  v_visit_doctor uuid;
  v_caller_doctor uuid;
begin
  v_caller_doctor := public.current_registration_doctor_id();
  if v_caller_doctor is null then
    raise exception 'Only active registration desk staff can update patient tracking status.';
  end if;
  if p_status not in ('waiting', 'in-consultation') then
    raise exception 'Registration desk can only set status to waiting or in-consultation.';
  end if;

  select status, doctor_id into v_current_status, v_visit_doctor from public.visits where id = p_visit_id;
  if v_current_status is null then
    raise exception 'Visit not found.';
  end if;
  if v_visit_doctor <> v_caller_doctor then
    raise exception 'You can only update visits for your own clinic.';
  end if;
  if v_current_status not in ('waiting', 'in-consultation') then
    raise exception 'This visit has moved past the waiting/in-consultation stage and can no longer be updated here.';
  end if;

  update public.visits set status = p_status where id = p_visit_id returning * into updated_row;
  return updated_row;
end;
$$;

-- Registration desk's payment verification action — mirrors verifyPayment()'s side
-- effect (visit -> completed) so the two entry points (doctor or registration desk,
-- whichever gets to it first) leave the data in the same consistent state. Only ever
-- touches status/verified_at, never amount/mode/screenshot.
create or replace function public.registration_set_payment_status(p_visit_id uuid, p_status text) returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.payments;
  v_visit_doctor uuid;
  v_caller_doctor uuid;
begin
  v_caller_doctor := public.current_registration_doctor_id();
  if v_caller_doctor is null then
    raise exception 'Only active registration desk staff can verify payments.';
  end if;
  if p_status not in ('pending', 'verified') then
    raise exception 'Invalid payment status.';
  end if;

  select doctor_id into v_visit_doctor from public.visits where id = p_visit_id;
  if v_visit_doctor is null then
    raise exception 'Visit not found.';
  end if;
  if v_visit_doctor <> v_caller_doctor then
    raise exception 'You can only verify payments for your own clinic.';
  end if;

  update public.payments
  set status = p_status, verified_at = case when p_status = 'verified' then now() else null end
  where visit_id = p_visit_id
  returning * into updated_row;

  if updated_row is null then
    raise exception 'Payment not found.';
  end if;

  if p_status = 'verified' then
    update public.visits set status = 'completed' where id = p_visit_id;
  else
    update public.visits set status = 'awaiting-payment' where id = p_visit_id and status = 'completed';
  end if;

  perform public.log_audit_event('registration_set_payment_status', 'payments', updated_row.id, jsonb_build_object('visit_id', p_visit_id, 'status', p_status));

  return updated_row;
end;
$$;


-- =====================================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================================

alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.consultations enable row level security;
alter table public.payments enable row level security;
alter table public.registration_staff enable row level security;
alter table public.audit_log enable row level security;
-- No policy is created for audit_log below, deliberately -- RLS enabled + zero
-- policies means the `authenticated` role gets zero rows/zero writes via the API no
-- matter what, which combined with no GRANT at all (see GRANTS below) makes this
-- table fully inaccessible through PostgREST. Only log_audit_event() (security
-- definer, owned by this migration's role, which is exempt from RLS on tables it
-- owns since FORCE ROW LEVEL SECURITY is never set here) can write to it.


-- =====================================================================================
-- 5. POLICIES
-- =====================================================================================
-- Every policy name this schema has ever used is dropped first (IF EXISTS, so this is
-- safe no matter which subset of past iterations your database currently has), then
-- the final, non-conflicting set is created. Each table gets exactly one policy per
-- (command, purpose) pair — no duplicates, nothing left over from an old design.

-- ---------- doctors ----------
-- Public directory read (patients need doctor name/fee/QR/status to book); a doctor
-- can only edit their own row (which is also what scopes profile-field edits and staff
-- account creation to "your own clinic only").
drop policy if exists "doctors_select" on public.doctors;
drop policy if exists "doctors_update_own" on public.doctors;

create policy "doctors_select" on public.doctors for select to authenticated using (true);
create policy "doctors_update_own" on public.doctors for update to authenticated
  using (firebase_uid = public.current_firebase_uid())
  with check (firebase_uid = public.current_firebase_uid());

-- ---------- patients ----------
-- Own row; any row if you're a doctor (doctor portal needs to view records); any row
-- with an active visit under a registration desk account's own doctor (front-desk
-- lookup, name/contact only by app-layer convention — no medical fields are ever
-- selected for that flow, see lib/db.js getRegistrationQueue). Patients can only ever
-- insert/update their OWN row — the vitals RPC above is the only doctor write path.
drop policy if exists "patients_select" on public.patients;
drop policy if exists "patients_insert_own" on public.patients;
drop policy if exists "patients_update_own" on public.patients;
drop policy if exists "patients_select_registration" on public.patients;

create policy "patients_select" on public.patients for select to authenticated
  using (firebase_uid = public.current_firebase_uid() or public.is_doctor());
create policy "patients_insert_own" on public.patients for insert to authenticated
  with check (firebase_uid = public.current_firebase_uid());
create policy "patients_update_own" on public.patients for update to authenticated
  using (firebase_uid = public.current_firebase_uid())
  with check (firebase_uid = public.current_firebase_uid());
create policy "patients_select_registration" on public.patients for select to authenticated
  using (public.patient_has_visit_with_registration_doctor(patients.id));

-- ---------- visits ----------
-- Patient can see/create their own visits (via create_visit, not a direct insert);
-- doctor can see/update visits assigned to them; registration desk can see (and, via
-- registration_set_visit_status, update within the waiting/in-consultation window)
-- only their own doctor's visits.
drop policy if exists "visits_select" on public.visits;
drop policy if exists "visits_insert_own_patient" on public.visits;
drop policy if exists "visits_update_own_doctor" on public.visits;
drop policy if exists "visits_select_registration" on public.visits;

create policy "visits_select" on public.visits for select to authenticated
  using (
    exists (select 1 from public.patients p where p.id = visits.patient_id and p.firebase_uid = public.current_firebase_uid())
    or exists (select 1 from public.doctors d where d.id = visits.doctor_id and d.firebase_uid = public.current_firebase_uid())
  );
create policy "visits_insert_own_patient" on public.visits for insert to authenticated
  with check (
    exists (select 1 from public.patients p where p.id = visits.patient_id and p.firebase_uid = public.current_firebase_uid())
  );
create policy "visits_update_own_doctor" on public.visits for update to authenticated
  using (exists (select 1 from public.doctors d where d.id = visits.doctor_id and d.firebase_uid = public.current_firebase_uid()))
  with check (exists (select 1 from public.doctors d where d.id = visits.doctor_id and d.firebase_uid = public.current_firebase_uid()));
create policy "visits_select_registration" on public.visits for select to authenticated
  using (doctor_id = public.current_registration_doctor_id());

-- ---------- consultations ----------
-- Readable by the owning patient or doctor; only the owning doctor writes. No
-- registration-desk policy exists here at all, on purpose — without a select grant
-- pathway, RLS blocks consultation notes/diagnoses/prescriptions outright, rather than
-- relying on the UI to just not display them.
drop policy if exists "consultations_select" on public.consultations;
drop policy if exists "consultations_write_own_doctor" on public.consultations;
drop policy if exists "consultations_update_own_doctor" on public.consultations;

create policy "consultations_select" on public.consultations for select to authenticated
  using (
    exists (select 1 from public.visits v join public.patients p on p.id = v.patient_id where v.id = consultations.visit_id and p.firebase_uid = public.current_firebase_uid())
    or exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = consultations.visit_id and d.firebase_uid = public.current_firebase_uid())
  );
create policy "consultations_write_own_doctor" on public.consultations for insert to authenticated
  with check (exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = consultations.visit_id and d.firebase_uid = public.current_firebase_uid()));
create policy "consultations_update_own_doctor" on public.consultations for update to authenticated
  using (exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = consultations.visit_id and d.firebase_uid = public.current_firebase_uid()))
  with check (exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = consultations.visit_id and d.firebase_uid = public.current_firebase_uid()));

-- ---------- payments ----------
-- Readable by owning patient/doctor/registration-desk (own doctor only); only the
-- owning doctor inserts (created inside completeConsultation); patient can update
-- their own payment but ONLY to 'awaiting-verification' (screenshot upload / cash
-- notice) — never to 'verified', which stays doctor/registration-desk-only via
-- payments_update_own_doctor / registration_set_payment_status respectively. This is
-- what stops a patient from self-verifying a payment.
drop policy if exists "payments_select" on public.payments;
drop policy if exists "payments_insert_own_doctor" on public.payments;
drop policy if exists "payments_update_own_doctor" on public.payments;
drop policy if exists "payments_update_own_patient" on public.payments;
drop policy if exists "payments_select_registration" on public.payments;

create policy "payments_select" on public.payments for select to authenticated
  using (
    exists (select 1 from public.visits v join public.patients p on p.id = v.patient_id where v.id = payments.visit_id and p.firebase_uid = public.current_firebase_uid())
    or exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = payments.visit_id and d.firebase_uid = public.current_firebase_uid())
  );
create policy "payments_insert_own_doctor" on public.payments for insert to authenticated
  with check (exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = payments.visit_id and d.firebase_uid = public.current_firebase_uid()));
create policy "payments_update_own_doctor" on public.payments for update to authenticated
  using (exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = payments.visit_id and d.firebase_uid = public.current_firebase_uid()))
  with check (exists (select 1 from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = payments.visit_id and d.firebase_uid = public.current_firebase_uid()));
create policy "payments_update_own_patient" on public.payments for update to authenticated
  using (exists (select 1 from public.visits v join public.patients p on p.id = v.patient_id where v.id = payments.visit_id and p.firebase_uid = public.current_firebase_uid()))
  with check (
    status = 'awaiting-verification'
    and exists (select 1 from public.visits v join public.patients p on p.id = v.patient_id where v.id = payments.visit_id and p.firebase_uid = public.current_firebase_uid())
  );
create policy "payments_select_registration" on public.payments for select to authenticated
  using (exists (select 1 from public.visits v where v.id = payments.visit_id and v.doctor_id = public.current_registration_doctor_id()));

-- ---------- registration_staff ----------
-- A staff member can look up their own row (needed for login). A doctor can
-- select/insert/update/delete only the staff rows they own (doctor_id = their own
-- doctor id) — this is what "Registration Desk accounts belong to exactly one doctor"
-- and "cannot manage other staff" are actually enforced by. There is no policy letting
-- a doctor see another doctor's staff, and no policy letting registration desk staff
-- write to this table at all (account management is doctor-only, staff never manage
-- themselves or anyone else).
drop policy if exists "registration_staff_select_own" on public.registration_staff;
drop policy if exists "registration_staff_select_own_doctor" on public.registration_staff;
drop policy if exists "registration_staff_insert_own_doctor" on public.registration_staff;
drop policy if exists "registration_staff_update_own_doctor" on public.registration_staff;
drop policy if exists "registration_staff_delete_own_doctor" on public.registration_staff;

create policy "registration_staff_select_own" on public.registration_staff for select to authenticated
  using (firebase_uid = public.current_firebase_uid());
create policy "registration_staff_select_own_doctor" on public.registration_staff for select to authenticated
  using (exists (select 1 from public.doctors d where d.id = registration_staff.doctor_id and d.firebase_uid = public.current_firebase_uid()));
create policy "registration_staff_insert_own_doctor" on public.registration_staff for insert to authenticated
  with check (exists (select 1 from public.doctors d where d.id = registration_staff.doctor_id and d.firebase_uid = public.current_firebase_uid()));
create policy "registration_staff_update_own_doctor" on public.registration_staff for update to authenticated
  using (exists (select 1 from public.doctors d where d.id = registration_staff.doctor_id and d.firebase_uid = public.current_firebase_uid()))
  with check (exists (select 1 from public.doctors d where d.id = registration_staff.doctor_id and d.firebase_uid = public.current_firebase_uid()));
create policy "registration_staff_delete_own_doctor" on public.registration_staff for delete to authenticated
  using (exists (select 1 from public.doctors d where d.id = registration_staff.doctor_id and d.firebase_uid = public.current_firebase_uid()));


-- =====================================================================================
-- 6. GRANTS
-- =====================================================================================
-- Table-level privileges (RLS policies above still apply on top of these — a grant
-- without a matching policy yields zero visible rows, not a bypass). Re-granting an
-- already-held privilege is a no-op, so this section is safe to re-run as-is.

grant select, update on public.doctors to authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, insert, update on public.visits to authenticated;
grant select, insert, update on public.consultations to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select, insert, update, delete on public.registration_staff to authenticated;

grant execute on function public.update_patient_vitals(uuid, numeric, numeric, int, int) to authenticated;
grant execute on function public.create_patient_by_staff(text, text, text, text, text, int, text, text, text, boolean, text, boolean, text, boolean, numeric, numeric) to authenticated;
grant execute on function public.find_patient_by_contact(text) to authenticated;
grant execute on function public.create_visit(uuid, uuid, date, text, text, boolean, text) to authenticated;
grant execute on function public.create_visit_by_staff(uuid, uuid, date, text, text, boolean, text) to authenticated;
grant execute on function public.link_patient_firebase_uid(uuid, text) to authenticated;
grant execute on function public.get_registration_queue_patients(uuid[]) to authenticated;
grant execute on function public.registration_set_visit_status(uuid, text) to authenticated;
grant execute on function public.registration_set_payment_status(uuid, text) to authenticated;
-- _book_visit and log_audit_event are intentionally NOT granted here (see their
-- REVOKE statements above) -- they are internal-only, reachable exclusively through
-- the public wrapper functions granted above.


-- =====================================================================================
-- 7. CONSTRAINTS
-- =====================================================================================
-- The frontend switches on these exact string literals (see lib/db.js / app pages), so
-- a bad write — a bug, a bypassed client, a future admin script — shouldn't be able to
-- produce a status value the UI has no rendering for. Dropped-then-added so this block
-- is idempotent (Postgres has no ADD CONSTRAINT IF NOT EXISTS for CHECK constraints).

alter table public.doctors drop constraint if exists doctors_status_check;
alter table public.doctors add constraint doctors_status_check
  check (status in ('Available', 'Busy'));

alter table public.visits drop constraint if exists visits_status_check;
alter table public.visits add constraint visits_status_check
  check (status in ('waiting', 'in-consultation', 'awaiting-payment', 'completed', 'cancelled'));

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'awaiting-verification', 'verified'));

-- Defense-in-depth against the "double-click creates two active queue entries" case
-- -- _book_visit() already guards against this explicitly under an advisory lock, so
-- this index should never actually need to reject anything in normal operation; it's
-- here in case some future code path ever writes to `visits` directly. Guarded: if
-- pre-existing data would violate this (duplicate active visits already exist for the
-- same patient/doctor/date/slot), this reports a NOTICE and skips instead of aborting
-- the rest of this script. If you see that notice, run:
--   select patient_id, doctor_id, date, slot, count(*) from public.visits
--   where status <> 'cancelled' group by 1,2,3,4 having count(*) > 1;
-- to find and resolve them (e.g. cancel the duplicate), then re-run this file.
do $$
begin
  create unique index if not exists visits_active_unique_idx
    on public.visits (patient_id, doctor_id, date, slot)
    where status <> 'cancelled';
exception when unique_violation then
  raise notice 'Skipped visits_active_unique_idx: duplicate active visits already exist for the same patient/doctor/date/slot. See the comment above this block for the query to find them, then re-run this file.';
end $$;


-- =====================================================================================
-- REALTIME (optional UX enhancement — safe no-op if unavailable)
-- =====================================================================================
-- Lets the doctor and registration-desk dashboards subscribe to live changes on
-- visits/payments (see lib/realtime.js) instead of requiring a manual refresh.
-- Guarded so this never breaks the rest of this script: if the table is already
-- published, or if this project's supabase_realtime publication doesn't exist for
-- some reason, this just reports a NOTICE. Nothing else in the app depends on this --
-- it's a live-update enhancement on top of the existing fetch-on-mount behavior, not
-- a replacement for it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits'
    ) then
      alter publication supabase_realtime add table public.visits;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
    ) then
      alter publication supabase_realtime add table public.payments;
    end if;
  else
    raise notice 'supabase_realtime publication not found -- skipping realtime setup (live dashboard updates will not be available; everything else is unaffected).';
  end if;
end $$;


-- =====================================================================================
-- 8. SEED DATA (fresh installs only — safe no-op on an existing database)
-- =====================================================================================
-- Matches the original mock-data doctor. firebase_uid starts NULL. on conflict (email)
-- do nothing makes this safe to re-run: it only ever inserts once, the first time this
-- email doesn't already exist.
insert into public.doctors (name, email, qr_code_url, consultation_fee, status, slot_config)
values (
  'Dr. Ayesha Kulkarni',
  'drayesha@mediqueue.local',
  '/doctor-qr.svg',
  500,
  'Available',
  '{"startTime":"09:00","endTime":"13:00","durationMinutes":20,"capacityPerSlot":1}'
)
on conflict (email) do nothing;

-- To provision a doctor login (manual, one-time, per doctor — there is no
-- self-registration for this role):
--   1. Firebase Console → Authentication → Users → Add user, with an email + password.
--   2. Copy the generated UID, then run:
--        update public.doctors set firebase_uid = '<uid-from-firebase-console>'
--        where email = '<the email you used above>';
--
-- Registration Desk accounts need no manual SQL at all — a signed-in doctor creates,
-- resets, deactivates, or deletes them from Doctor Dashboard → Staff in the app.
