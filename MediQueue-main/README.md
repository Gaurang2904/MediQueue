# MediQueue — Doctor Appointment & Patient Management System

A Next.js + Tailwind CSS rebuild of the clinic app, implementing the Patient and Doctor
portals described in the project SRS: registration, visit booking with slot locking,
queue tokens, doctor consultations (diagnosis + prescriptions), payment selection/
verification, and a transaction dashboard.

## Running locally

```
npm install
npm run dev
```

Open http://localhost:3000.

- Patient portal: enter a 10-digit number on the home page. New numbers go to
  registration; existing patients go straight to booking a visit.
- Doctor portal: `/doctor/login` — demo credentials `drayesha` / `doctor123`.

## Data layer — important for the team

This build has **no server and no real database**. `lib/db.js` is a mock store backed
by the browser's `localStorage`, whose collections and function shapes mirror the
Firestore collections in the SRS (`patients`, `doctors`, `visits`, `consultations`,
`payments`). Sessions live in `localStorage` too (`lib/auth.js`), not cookies.

Because everything lives in `localStorage`:
- Data is per-browser, per-device. Registering a patient in one browser won't be visible
  from a different browser or device — there's no shared backend.
- Clearing site data / browser storage wipes the demo data.
- Multiple tabs of the *same* browser share the same data (localStorage is per-origin),
  so you can demo the patient flow in one tab and the doctor flow in another.

There are no `app/api/**` routes — pages and components call the `lib/db.js` functions
directly (client-side). This lets the whole app build as a static export (`next build`
with `output: "export"` in `next.config.js`) and deploy to Netlify with no server
runtime at all (see `netlify.toml`).

When wiring up real Firebase later:
- Swap the internals of `lib/db.js` (`readDb`/`writeDb`) for Firestore calls — callers
  elsewhere only use the exported function names, so page/component code shouldn't need
  to change.
- Replace `lib/auth.js`'s localStorage session with Firebase Authentication.
- `components/QueueStatus.js` currently polls `getQueueStatus()` every 5s — this is the
  spot to swap in a Firestore realtime listener.
- Remove `output: "export"` once server-side rendering / API routes are back in play.
- See `.env.local.example` for the Firebase config placeholders.

## Deploying to Netlify

```
npm run build
```

produces a static `out/` directory. `netlify.toml` already points Netlify's build at
`npm run build` with `publish = "out"` — connect the repo (or drag-and-drop `out/`) and
it deploys with no other configuration.
