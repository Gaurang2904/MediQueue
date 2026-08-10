import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase RLS is scoped to Firebase's ID token (see supabase.sql), so every
// request needs to carry the signed-in user's current token as its bearer auth.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => {
    const user = auth.currentUser;
    // TEMP DIAGNOSTIC — remove after RLS investigation. Never logs the raw token.
    if (!user) {
      console.log("[diag:accessToken] auth.currentUser is NULL at request time — this request will fall back to the anon key.");
      return null;
    }
    const token = await user.getIdToken();
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      console.log(
        "[diag:accessToken] uid=%s tokenPresent=%s sub=%s aud=%s iss=%s exp=%s",
        user.uid,
        !!token,
        payload.sub,
        payload.aud,
        payload.iss,
        payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined
      );
      // TEMP DIAGNOSTIC — checks whether the JWT carries a "role" claim, which is what
      // PostgREST uses to SET ROLE for the request (falls back to the anon role when
      // absent). Logs the claim value only (not sensitive) plus the full list of claim
      // KEY NAMES (no values) so we can see what's actually in the token without
      // printing anything sensitive like email.
      console.log(
        "[diag:accessToken] role claim present=%s value=%s allClaimKeys=%s",
        Object.prototype.hasOwnProperty.call(payload, "role"),
        Object.prototype.hasOwnProperty.call(payload, "role") ? payload.role : "ABSENT",
        Object.keys(payload).join(",")
      );
    } catch {
      console.log("[diag:accessToken] uid=%s tokenPresent=%s (payload decode failed, logging skipped)", user.uid, !!token);
    }
    return token;
  },
});
