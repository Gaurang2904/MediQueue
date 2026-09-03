"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionPatientId } from "@/lib/auth";
import { getPatientById } from "@/lib/db";
import { useAuthState } from "@/lib/AuthProvider";

// Shared "load the signed-in patient's record, redirect home if there isn't one" pattern
// used by every top-level patient page (dashboard, visit/new).
export function useCurrentPatient() {
  const router = useRouter();
  const { status } = useAuthState();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // AuthProvider is still restoring/resolving the Firebase session -- stay on this
    // page showing a loading state rather than deciding anything yet (a null
    // auth.currentUser here doesn't mean "logged out", just "not resolved yet").
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        if (status !== "authenticated") {
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
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  return { patient, error };
}
