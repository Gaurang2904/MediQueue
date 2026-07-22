"use client";

import { useRouter } from "next/navigation";
import { clearPatientSession, clearDoctorSession } from "@/lib/auth";

export default function LogoutButton({ redirectTo = "/doctor/login", className }) {
  const router = useRouter();

  async function handleLogout() {
    clearPatientSession();
    clearDoctorSession();
    router.push(redirectTo);
  }

  return (
    <button
      onClick={handleLogout}
      className={className || "block w-full text-left rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"}
    >
      Log out
    </button>
  );
}
