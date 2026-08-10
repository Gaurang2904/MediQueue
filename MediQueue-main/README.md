# MediQueue — Doctor Appointment & Patient Management System

A Next.js + Tailwind CSS clinic app implementing the Patient and Doctor portals
described in the project SRS: registration, visit booking with slot locking, queue
tokens, doctor consultations (diagnosis + prescriptions), payment selection/
verification, and a transaction dashboard.

## Architecture

- **Authentication**: Firebase Authentication, email/password, for both patients and
  doctors (`lib/firebaseAuth.js`).
- **Database**: Supabase Postgres is the single source of truth — `patients`, `doctors`,
  `visits`, `consultations`, `payments` (schema + Row Level Security policies in
  `supabase.sql`). All CRUD goes through `lib/db.js`.
- **Authorization**: Postgres RLS scoped to the signed-in Firebase user, via Supabase's
  Third-Party Auth integration. `lib/supabase.js` attaches the current Firebase ID
  token as the bearer auth on every Supabase request; the RLS policies in
  `supabase.sql` read it back with `auth.jwt()->>'sub'` to scope each patient/doctor to
  their own rows.
- **Sessions**: `lib/auth.js` keeps a small localStorage pointer (`mediqueue-pid` /
  `mediqueue-did`) recording which patient/doctor record is active in the current
  browser tab. This is a UI convenience only — the actual access control is the
  Firebase JWT + Supabase RLS above, not this pointer.
- No `app/api/**` routes — pages and components call `lib/db.js` directly
  (client-side), which is what lets the whole app build as a static export
  (`output: "export"` in `next.config.js`) and deploy to Netlify with no server
  runtime for the app itself.
- **Registration Desk** is an optional third role (payment verification + patient
  status tracking only — no consultation/medical-history access), doctor-managed from
  Doctor Dashboard → Staff. Creating, resetting the password for, deactivating, or
  deleting a staff account are the one place this app *does* need a server: Firebase's
  client SDK can't do those to another user's account. A handful of Netlify Functions
  under `netlify/functions/` handle exactly those four privileged calls (Firebase
  Admin SDK) — see "Staff account backend" below.

## Running locally

```
npm install
npm run dev
```

Open http://localhost:3000.

- Patient portal: register at `/register`, then sign in at `/patient/login`.
- Doctor portal: `/doctor/login` (see "Supabase setup" below to create and link a
  doctor account — there is no seeded doctor login until you do this).

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in both sets of values — the app
needs both Firebase and Supabase configured to run at all:

- `NEXT_PUBLIC_FIREBASE_*` — from your Firebase project's Web App config.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase
  project's API settings.

Because this is a static export, `NEXT_PUBLIC_*` values are baked into the client
bundle **at build time**. When deploying to Netlify, set the same variables in
**Site settings → Environment variables** — a build without them will ship with
`undefined` Firebase/Supabase config and every page will fail at runtime.

## Supabase setup (one-time)

1. Supabase SQL Editor → run `supabase.sql` in full. It's idempotent — safe to run on
   a brand-new project, and just as safe to re-run later after pulling schema changes
   from this repo: every statement uses `IF NOT EXISTS` / `CREATE OR REPLACE` /
   `DROP ... IF EXISTS`, nothing ever drops a table, and it never touches existing
   rows. This creates the tables, indexes, functions, RLS policies, and a seed doctor
   row (skipped if one already exists).
2. Supabase Dashboard → **Authentication → Sign In / Providers → Third-Party Auth →
   Add provider → Firebase**, using your Firebase project ID
   (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`). This is what lets `auth.jwt()` in the RLS
   policies understand Firebase ID tokens — without it, every Supabase request from
   the app fails with a JWT verification error.
3. Firebase Console → Authentication → Users → add a user for the doctor, then link
   it to the seed doctor row:
   ```sql
   update public.doctors set firebase_uid = '<uid-from-firebase-console>'
   where email = 'drayesha@mediqueue.local';
   ```

## Staff account backend (Netlify Functions)

Registration Desk accounts are created and managed entirely from Doctor Dashboard →
Staff — there's no manual provisioning step and no self-registration page for this
role. Four small serverless functions in `netlify/functions/` do the one thing the
browser can't: create, reset the password for, deactivate, or delete *another* user's
Firebase account (the Admin SDK only). They never touch Supabase with elevated
privileges — all `registration_staff` table writes still go through the browser's
normal Supabase client, gated by the doctor-owns-this-row RLS policies in
`supabase.sql`.

This needs one more secret, server-side only (**not** `NEXT_PUBLIC_*` — never bundled
into the client):

1. Firebase Console → Project settings → Service accounts → **Generate new private
   key**. This downloads a JSON file with `project_id`, `client_email`, and
   `private_key`.
2. Set these as environment variables (Netlify dashboard → Site settings →
   Environment variables for production; a local `.env` file for `netlify dev`):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` — paste the key as-is; the function code un-escapes the
     literal `\n` sequences the JSON file contains.

**Local testing**: plain `next dev` does not serve `/.netlify/functions/*`, so Staff
Management's create/reset/deactivate/delete actions won't work under `npm run dev`.
Install the Netlify CLI (`npm install -g netlify-cli`) and run `netlify dev` instead —
it proxies both the Next.js dev server and the local functions together on one port.
Everything else in the app runs identically either way.

## Deploying to Netlify

```
npm run build
```

produces a static `out/` directory. `netlify.toml` points Netlify's build at
`npm run build` with `publish = "out"`, and also declares the `netlify/functions`
directory so the staff-account functions above deploy alongside it — connect the repo
and set all the environment variables (Firebase/Supabase public config above, plus the
three Firebase Admin secrets) in the Netlify dashboard before the first deploy.
