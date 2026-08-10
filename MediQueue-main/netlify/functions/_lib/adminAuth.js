// Shared helpers for the staff-*.js functions. These are the ONLY place in the app
// that uses the Firebase Admin SDK -- everything else (including all Postgres writes
// on registration_staff) goes through the browser's normal Supabase client, gated by
// RLS. Keeping the privileged surface this narrow means the only new secret this
// feature needs is a Firebase service-account credential, not a Supabase service-role
// key.
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function supabaseRest(path, idToken) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) throw httpError(502, "Failed to reach the database.");
  return res.json();
}

// Verifies the caller's Firebase ID token, then confirms they're a doctor by asking
// Supabase for a doctors row matching their uid -- the same RLS-scoped read the
// browser's own Supabase client already performs, just done here with the caller's own
// token instead of a service-role key.
async function requireDoctor(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const idToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!idToken) throw httpError(401, "Missing authorization token.");

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    throw httpError(401, "Invalid or expired session. Please sign in again.");
  }

  const rows = await supabaseRest(`doctors?firebase_uid=eq.${decoded.uid}&select=id`, idToken);
  if (!Array.isArray(rows) || !rows[0]) {
    throw httpError(403, "Only doctors can manage registration desk staff.");
  }

  return { uid: decoded.uid, idToken, doctorId: rows[0].id };
}

// Confirms the target registration_staff account belongs to the calling doctor, using
// the doctor-scoped registration_staff_select_own_doctor RLS policy (see supabase.sql)
// -- a doctor can never even see, let alone act on, another doctor's staff row.
async function requireOwnedStaff(idToken, doctorId, firebaseUid) {
  const rows = await supabaseRest(
    `registration_staff?firebase_uid=eq.${firebaseUid}&select=doctor_id`,
    idToken
  );
  if (!Array.isArray(rows) || !rows[0] || rows[0].doctor_id !== doctorId) {
    throw httpError(404, "Staff account not found.");
  }
}

// Verifies the caller's own Firebase ID token and returns their uid -- for endpoints
// that only ever act on the caller's own account (e.g. ensure-auth-role.js), where
// proving "this token is genuinely yours" is the entire authorization check needed;
// no cross-user Supabase ownership lookup like requireDoctor performs is required.
async function verifyCaller(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const idToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!idToken) throw httpError(401, "Missing authorization token.");

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    throw httpError(401, "Invalid or expired session. Please sign in again.");
  }

  return { uid: decoded.uid, idToken };
}

module.exports = { admin, httpError, requireDoctor, requireOwnedStaff, verifyCaller };
