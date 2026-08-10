"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionPatientId } from "@/lib/auth";
import { observeAuth } from "@/lib/firebaseAuth";
import { getPatientById } from "@/lib/db";

// Shared "load the signed-in patient's record, redirect home if there isn't one" pattern
// used by every top-level patient page (dashboard, visit/new).
export function useCurrentPatient() {
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Wait for Firebase to finish restoring its session (onAuthStateChanged's first
    // callback) before querying Supabase — on a hard reload, auth.currentUser is still
    // null for a moment, and querying before then makes the Supabase client fall back
    // to an unauthenticated request, which RLS blocks and looks like "no such patient".
    // Only the first callback matters here (this effect fetches once per mount), so the
    // listener is torn down as soon as it fires.
    const unsubscribe = observeAuth((firebaseUser) => {
      unsubscribe();
      if (cancelled) return;
      (async () => {
        try {
          if (!firebaseUser) {
            router.push("/");
            return;
          }
          const patientId = getSessionPatientId();
          const p = patientId ? await getPatientById(patientId) : null;
          if (cancelled) return;
          if (!p) {
            router.push("/");
            return;
          }
          setPatient(p);
        } catch (err) {
          if (!cancelled) setError(err.message || "Failed to load your account. Please refresh the page.");
        }
      })();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  return { patient, error };
}
