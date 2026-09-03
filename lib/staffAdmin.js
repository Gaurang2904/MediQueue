// Client for the netlify/functions/staff-*.js endpoints -- the only privileged
// operations in the app (create/reset-password/disable/delete another user's Firebase
// account). Every call carries the signed-in doctor's own Firebase ID token; the
// function verifies it server-side and confirms doctor + staff-ownership before doing
// anything (see netlify/functions/_lib/adminAuth.js).
import { auth } from "./firebase";

async function callStaffFunction(name, body) {
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

export function createStaffFirebaseAccount({ name, email, password }) {
  return callStaffFunction("staff-create", { name, email, password });
}

export function resetStaffPassword({ firebaseUid, newPassword }) {
  return callStaffFunction("staff-reset-password", { firebaseUid, newPassword });
}

export function setStaffFirebaseActive({ firebaseUid, active }) {
  return callStaffFunction("staff-set-active", { firebaseUid, active });
}

export function deleteStaffFirebaseAccount({ firebaseUid }) {
  return callStaffFunction("staff-delete", { firebaseUid });
}
