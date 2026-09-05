"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearPatientSession, clearDoctorSession, clearRegistrationSession, clearAdminSession } from "@/lib/auth";
import { logout } from "@/lib/firebaseAuth";

export default function LogoutButton({ redirectTo = "/doctor/login", className }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logout();
    } catch (err) {
      console.error("Firebase sign-out failed:", err);
    } finally {
      // Always clear the local session pointer and navigate away, even if the
      // Firebase sign-out call itself failed — otherwise a failed signOut() left
      // the user stuck on the page with no redirect and no feedback.
      clearPatientSession();
      clearDoctorSession();
      clearRegistrationSession();
      clearAdminSession();
      router.push(redirectTo);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={className || "block w-full text-left rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"}
    >
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}
