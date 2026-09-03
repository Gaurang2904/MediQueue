// Firebase ID tokens carry no Postgres role by default, so Supabase's Firebase
// Third-Party Auth integration falls back to the "anon" role unless the token has a
// "role": "authenticated" custom claim. This is the only place that claim is ever
// written -- via the Firebase Admin SDK, server-side, never in client code. Called by
// lib/firebaseAuth.js's signUp()/signIn() wrappers after every sign-up/sign-in.
//
// A caller can only ever set this claim on their OWN account (verifyCaller proves the
// bearer token is genuinely theirs) -- there is no cross-user access here. The claim
// itself grants nothing beyond what every legitimate signed-in user is already meant
// to have; RLS (see supabase.sql) still does all of the actual per-user/per-role
// authorization. This function does not change or replace that in any way.
const { admin, httpError, verifyCaller } = require("./_lib/adminAuth");

exports.handler = async (event) => {
  // TEMP DIAGNOSTIC — these print to the FUNCTION's own log (Netlify Dashboard ->
  // Functions -> ensure-auth-role -> real-time logs, or the `netlify dev` terminal if
  // running locally) -- NOT the browser console. Confirms which Firebase project this
  // function's Admin SDK credential actually points at (project ID is not sensitive --
  // it's the same value already public in NEXT_PUBLIC_FIREBASE_PROJECT_ID).
  console.log("[diag:ensure-auth-role] invoked, FIREBASE_PROJECT_ID=%s", process.env.FIREBASE_PROJECT_ID);
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { uid } = await verifyCaller(event);
    console.log("[diag:ensure-auth-role] verifyCaller resolved uid=%s", uid);

    const userRecord = await admin.auth().getUser(uid);
    console.log("[diag:ensure-auth-role] getUser resolved, existing customClaims=%s", JSON.stringify(userRecord.customClaims || {}));
    if (userRecord.customClaims?.role === "authenticated") {
      console.log("[diag:ensure-auth-role] already authenticated, no write needed");
      return { statusCode: 200, body: JSON.stringify({ ok: true, alreadySet: true }) };
    }

    await admin.auth().setCustomUserClaims(uid, { ...userRecord.customClaims, role: "authenticated" });
    const confirmRecord = await admin.auth().getUser(uid);
    console.log("[diag:ensure-auth-role] setCustomUserClaims done, re-read customClaims=%s", JSON.stringify(confirmRecord.customClaims || {}));
    return { statusCode: 200, body: JSON.stringify({ ok: true, alreadySet: false }) };
  } catch (err) {
    console.error("[diag:ensure-auth-role] FAILED:", err);
    const statusCode = err.statusCode || 500;
    return { statusCode, body: JSON.stringify({ message: err.message || "Something went wrong." }) };
  }
};
