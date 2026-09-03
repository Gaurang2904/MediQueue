"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { observeAuth, ensureAuthenticatedRole } from "./firebaseAuth";

// Single source of truth for "where is Firebase in restoring/establishing a session"
// across the whole app. Firebase's auth.currentUser can be null for a moment on a
// hard reload while it's still restoring a persisted session -- that is NOT the same
// thing as "the user is logged out", so this exposes a third state (`loading`)
// instead of only true/false, and every portal gate (hooks/useCurrentPatient.js,
// app/doctor/(portal)/layout.js, app/registration/(portal)/layout.js) waits for
// `loading` to resolve before deciding whether to redirect to a login page.
//
// This also centralizes ensureAuthenticatedRole(): previously it only ran inside
// signIn()/signUp(), so a session restored on refresh (rather than a fresh sign-in)
// never got the "role": "authenticated" custom claim self-healed if it was somehow
// never durably set the first time. Running it here, on every transition to a
// signed-in user, and awaiting it BEFORE flipping status to "authenticated", means
// every Supabase query issued by a gated page is guaranteed to see a token carrying
// that claim -- otherwise RLS silently returns zero rows (not an error), which is
// what previously looked identical to "not authenticated" and caused refreshes to
// bounce a genuinely signed-in user back to a login page.
const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", firebaseUser: null });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = observeAuth((firebaseUser) => {
      (async () => {
        if (firebaseUser) {
          await ensureAuthenticatedRole(firebaseUser);
        }
        if (cancelled) return;
        setState({
          status: firebaseUser ? "authenticated" : "unauthenticated",
          firebaseUser,
        });
      })();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

// Returns { status: "loading" | "authenticated" | "unauthenticated", firebaseUser }.
export function useAuthState() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuthState must be used within AuthProvider.");
  }
  return ctx;
}
