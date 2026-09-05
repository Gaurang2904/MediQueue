"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSessionAdminId } from "@/lib/auth";
import { getAdminByFirebaseUid } from "@/lib/db";
import { useAuthState } from "@/lib/AuthProvider";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";
import LoadingState from "@/components/LoadingState";
import { AdminContext } from "@/hooks/useCurrentAdmin";

const LINKS = [{ href: "/admin/dashboard", label: "Doctors" }];

export default function AdminPortalLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, firebaseUser } = useAuthState();
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Wait for AuthProvider to resolve -- a null currentUser during session restore is
    // not the same as "logged out". Same gate as the doctor and registration layouts.
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        if (status !== "authenticated" || !firebaseUser) {
          router.push("/admin/login");
          return;
        }
        // Re-derived from the Firebase uid rather than trusted from localStorage: the
        // session pointer only says which portal this tab is in, it is not authority.
        const a = await getAdminByFirebaseUid(firebaseUser.uid);
        if (cancelled) return;
        if (!a || (getSessionAdminId() && getSessionAdminId() !== a.id)) {
          router.push("/admin/login");
          return;
        }
        setAdmin(a);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load your account. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, firebaseUser, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-rejected-text">{error}</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState label="Loading your account..." />
      </div>
    );
  }

  return (
    <AdminContext.Provider value={admin}>
      <div className="flex min-h-screen">
        <Sidebar brand="Admin" links={LINKS} activeHref={pathname} footer={<LogoutButton redirectTo="/admin/login" />} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}
