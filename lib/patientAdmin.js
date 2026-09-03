// Client for netlify/functions/patient-create.js -- the one privileged patient-related
// operation in the app (creating a Firebase account for a walk-in patient being
// linked). Mirrors lib/staffAdmin.js exactly. Every call carries the signed-in
// doctor/staff member's own Firebase ID token; the function verifies it server-side
// (requireDoctorOrStaff) before doing anything.
import { auth } from "./firebase";

async function callPatientFunction(name, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  const idToken = await user.getIdToken();

  const res = await fetch(`/.netlify/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed.");
  return data;
}

export function createPatientFirebaseAccount({ name, email, password }) {
  return callPatientFunction("patient-create", { name, email, password });
}
