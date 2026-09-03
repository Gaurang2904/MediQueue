"use client";

import { useEffect, useState } from "react";
import { getDoctors } from "@/lib/db";
import VisitForm from "@/components/VisitForm";
import LoadingState from "@/components/LoadingState";
import { useCurrentPatient } from "@/hooks/useCurrentPatient";

export default function NewVisitPage() {
  const { patient, error: patientError } = useCurrentPatient();
  const [doctor, setDoctor] = useState(null);
  const [error, setError] = useState("");
  const [noDoctor, setNoDoctor] = useState(false);

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    (async () => {
      try {
        const doctors = await getDoctors();
        if (cancelled) return;
        if (doctors.length === 0) {
          setNoDoctor(true);
          return;
        }
        setDoctor(doctors[0]);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load booking details. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patient]);

  if (patientError || error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-rejected-text">{patientError || error}</p>
      </div>
    );
  }

  if (noDoctor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-3 text-center">No doctor is available for booking right now. Please try again later.</p>
      </div>
    );
  }

  if (!patient || !doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState label="Loading booking details..." />
      </div>
    );
  }

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
