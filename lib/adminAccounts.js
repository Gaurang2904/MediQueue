// Client for netlify/functions/doctor-create.js -- the admin page's half of account
// provisioning. Same shape and same contract as lib/staffAdmin.js: the call carries the
// signed-in admin's own Firebase ID token, the function verifies it server-side and
// confirms there is a matching public.admins row before creating anything.
//
// Only the Firebase account is created here. The public.doctors row is inserted by the
// browser afterwards (createDoctorRow in lib/db.js), under the doctors_insert_admin
// policy -- so this endpoint never writes to Postgres with elevated privileges.
import { auth } from "./firebase";

export async function createDoctorFirebaseAccount({ name, email, password }) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  const idToken = await user.getIdToken();

  const res = await fetch("/.netlify/functions/doctor-create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed.");
  return data;
}
