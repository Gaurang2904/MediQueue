"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSessionRegistrationId, clearRegistrationSession } from "@/lib/auth";
import { observeAuth } from "@/lib/firebaseAuth";
import { getRegistrationStaffById } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";
import LoadingState from "@/components/LoadingState";
import { RegistrationContext } from "@/hooks/useCurrentRegistration";

const LINKS = [{ href: "/registration/dashboard", label: "Dashboard" }];

export default function RegistrationPortalLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Wait for Firebase to finish restoring its session (onAuthStateChanged's first
    // callback) before querying Supabase — on a hard reload, auth.currentUser is still
    // null for a moment, and querying before then makes the Supabase client fall back
    // to an unauthenticated request, which RLS blocks and looks like "no such staff
    // account". Only the first callback matters here (this effect fetches once per
    // mount), so the listener is torn down as soon as it fires.
    const unsubscribe = observeAuth((firebaseUser) => {
      unsubscribe();
      if (cancelled) return;
      (async () => {
        try {
          if (!firebaseUser) {
            router.push("/registration/login");
            return;
          }
          const registrationId = getSessionRegistrationId();
          const r = registrationId ? await getRegistrationStaffById(registrationId) : null;
          if (cancelled) return;
          if (!r || !r.active) {
            // A deactivated account may still hold a technically-valid Firebase ID
            // token for a short window -- this check is what actually cuts off access,
            // independent of when the client happens to notice the Firebase side.
            clearRegistrationSession();
            router.push("/registration/login");
            return;
          }
          setRegistration(r);
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-rejected-text">{error}</p>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState label="Loading your account..." />
      </div>
    );
  }

  return (
    <RegistrationContext.Provider value={registration}>
      <div className="flex min-h-screen">
        <Sidebar brand={registration.name} links={LINKS} activeHref={pathname} footer={<LogoutButton redirectTo="/registration/login" />} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </RegistrationContext.Provider>
  );
}
