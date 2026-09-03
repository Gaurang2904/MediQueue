import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "./firebase";

// Firebase ID tokens carry no Postgres role by default, so Supabase's Firebase
// Third-Party Auth integration falls back to the "anon" role unless the token has a
// "role": "authenticated" custom claim (see netlify/functions/ensure-auth-role.js,
// the only place that claim is ever written -- via the Firebase Admin SDK, server-side).
// Checks the *current* token first so this only ever costs a network round trip once
// per user (their first sign-in after this shipped) -- every token issued after the
// claim is set already carries it, so later calls see role === "authenticated" and
// return immediately.
//
// Exported (not just called from signUp/signIn) so lib/AuthProvider.js can also call
// this every time a session is *restored* (onAuthStateChanged firing on page load),
// not only on a fresh sign-in -- that's what makes the claim self-heal on refresh if
// it was never durably set the first time (e.g. a transient failure, or local dev
// without `netlify dev` serving netlify/functions/*).
export async function ensureAuthenticatedRole(user) {
  try {
    const before = await user.getIdTokenResult();
    if (before.claims.role === "authenticated") {
      return;
    }

    const idToken = await user.getIdToken();
    const res = await fetch("/.netlify/functions/ensure-auth-role", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`ensure-auth-role request failed (status ${res.status})`);

    // The claim only takes effect on a freshly issued token -- force a refresh so the
    // very next Supabase call already carries it.
    await user.getIdTokenResult(true);
  } catch (err) {
    // Deliberately non-fatal: signUp()/signIn() must still resolve normally even if this
    // fails (e.g. the function is briefly unreachable), so callers' existing error
    // handling and rollback logic (see app/register/page.js) is unaffected. If the claim
    // truly didn't get set, the next Supabase call fails its RLS check exactly as before
    // this fix, and the next successful call to this function self-heals it.
    console.error("Failed to ensure authenticated role claim:", err);
  }
}

export async function signUp(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await ensureAuthenticatedRole(credential.user);
  return credential;
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await ensureAuthenticatedRole(credential.user);
  return credential;
}

export async function logout() {
  return await signOut(auth);
}

export async function deleteAccount(user) {
  return await deleteUser(user);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
