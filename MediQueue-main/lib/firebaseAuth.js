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
// claim is set already carries it, so later sign-ins see role === "authenticated" and
// return immediately.
async function ensureAuthenticatedRole(user) {
  console.log("[diag:ensureRole] called for uid=%s", user.uid);
  try {
    const before = await user.getIdTokenResult();
    console.log("[diag:ensureRole] current token role claim=%s", before.claims.role ?? "ABSENT");
    if (before.claims.role === "authenticated") {
      console.log("[diag:ensureRole] already authenticated, skipping function call");
      return;
    }

    const idToken = await user.getIdToken();
    console.log("[diag:ensureRole] calling POST /.netlify/functions/ensure-auth-role");
    const res = await fetch("/.netlify/functions/ensure-auth-role", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    // Read the body BEFORE branching on res.ok -- a 404 (route not served, e.g. running
    // `next dev` instead of `netlify dev`) still has a body, and we need to see it either way.
    const bodyText = await res.text().catch(() => "<unreadable body>");
    console.log("[diag:ensureRole] function responded status=%s ok=%s body=%s", res.status, res.ok, bodyText);
    if (!res.ok) throw new Error(`ensure-auth-role request failed (status ${res.status})`);

    // The claim only takes effect on a freshly issued token -- force a refresh so the
    // very next Supabase call (which may happen immediately after signUp()/signIn()
    // resolves) already carries it.
    const after = await user.getIdTokenResult(true);
    console.log("[diag:ensureRole] after forced refresh, token role claim=%s", after.claims.role ?? "ABSENT");
  } catch (err) {
    // Deliberately non-fatal: signUp()/signIn() must still resolve normally even if this
    // fails (e.g. the function is briefly unreachable), so callers' existing error
    // handling and rollback logic (see app/register/page.js) is unaffected. If the claim
    // truly didn't get set, the next Supabase call fails its RLS check exactly as before
    // this fix, and the next successful call to this function self-heals it.
    console.error("[diag:ensureRole] FAILED:", err);
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