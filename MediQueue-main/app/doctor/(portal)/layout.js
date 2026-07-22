"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionDoctorId } from "@/lib/auth";
import { getDoctor } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";

const LINKS = [
  { href: "/doctor/dashboard", label: "Dashboard" },
  { href: "/doctor/patients", label: "Patients" },
  { href: "/doctor/transactions", label: "Transactions" },
];

export default function DoctorPortalLayout({ children }) {
  const router = useRouter();
  const [doctor, setDoctor] = useState(null);

  useEffect(() => {
    const doctorId = getSessionDoctorId();
    const d = doctorId ? getDoctor(doctorId) : null;
    if (!d) {
      router.push("/doctor/login");
      return;
    }
    setDoctor(d);
  }, [router]);

  if (!doctor) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar brand={doctor.name} links={LINKS} footer={<LogoutButton />} />
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
