"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSessionDoctorId } from "@/lib/auth";
import { getDoctor } from "@/lib/db";
import { useAuthState } from "@/lib/AuthProvider";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";
import LoadingState from "@/components/LoadingState";
import { DoctorContext } from "@/hooks/useCurrentDoctor";

const LINKS = [
  { href: "/doctor/dashboard", label: "Dashboard" },
  { href: "/doctor/patients", label: "Patients" },
  { href: "/doctor/transactions", label: "Transactions" },
  { href: "/doctor/staff", label: "Staff" },
  { href: "/doctor/profile", label: "Profile" },
];

export default function DoctorPortalLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuthState();
  const [doctor, setDoctor] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // AuthProvider is still restoring/resolving the Firebase session -- on a hard
    // reload auth.currentUser can be briefly null while that happens, and that is NOT
    // the same as "logged out", so wait for a definite answer before redirecting.
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        if (status !== "authenticated") {
          router.push("/doctor/login");
          return;
        }
        const doctorId = getSessionDoctorId();
        const d = doctorId ? await getDoctor(doctorId) : null;
        if (cancelled) return;
        if (!d) {
          router.push("/doctor/login");
          return;
        }
        setDoctor(d);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load your account. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-rejected-text">{error}</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState label="Loading your account..." />
      </div>
    );
  }

  return (
    <DoctorContext.Provider value={doctor}>
      <div className="flex min-h-screen">
        <Sidebar brand={doctor.name} links={LINKS} activeHref={pathname} footer={<LogoutButton />} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </DoctorContext.Provider>
  );
}
