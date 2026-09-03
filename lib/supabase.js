import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase RLS is scoped to Firebase's ID token (see supabase.sql), so every
// request needs to carry the signed-in user's current token as its bearer auth.
// lib/AuthProvider.js waits for ensureAuthenticatedRole() to finish before any portal
// page queries Supabase, so by the time auth.currentUser is set here, its cached ID
// token already carries the "role": "authenticated" claim RLS depends on.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  },
});
