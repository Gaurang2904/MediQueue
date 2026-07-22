"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionPatientId } from "@/lib/auth";
import { getPatientById, getDoctors } from "@/lib/db";
import VisitForm from "@/components/VisitForm";

export default function NewVisitPage() {
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [doctor, setDoctor] = useState(null);

  useEffect(() => {
    const patientId = getSessionPatientId();
    const p = patientId ? getPatientById(patientId) : null;
    if (!p) {
      router.push("/");
      return;
    }
    setPatient(p);
    setDoctor(getDoctors()[0]);
  }, [router]);

  if (!patient || !doctor) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-ink">Welcome back, {patient.name.split(" ")[0]}</h1>
          <p className="text-ink-2 text-sm mt-1">Book your visit with {doctor.name}</p>
        </div>
        <VisitForm patient={patient} doctor={doctor} />
      </div>
    </div>
  );
}
