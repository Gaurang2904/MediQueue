"use client";

import { useEffect, useState } from "react";
import { getDoctors } from "@/lib/db";
import VisitForm from "@/components/VisitForm";
import LoadingState from "@/components/LoadingState";
import { useCurrentPatient } from "@/hooks/useCurrentPatient";

// This page used to call getDoctors() and book against doctors[0]. That was written
// when the clinic had exactly one doctor; with more than one it silently picked
// whichever row Postgres happened to return first, which is not stable (see the note
// on getDoctors in lib/db.js). The patient now chooses, and the choice is only skipped
// when there is genuinely nothing to choose between.
export default function NewVisitPage() {
  const { patient, error: patientError } = useCurrentPatient();
  const [doctors, setDoctors] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getDoctors();
        if (cancelled) return;
        setDoctors(list);
        // A single-doctor clinic shouldn't have to pick from a list of one.
        if (list.length === 1) setSelectedId(list[0].id);
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

  if (!patient || doctors === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState label="Loading booking details..." />
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-3 text-center">No doctor is available for booking right now. Please try again later.</p>
      </div>
    );
  }

  const selectedDoctor = doctors.find((d) => d.id === selectedId) || null;
  const firstName = patient.name.split(" ")[0];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-ink">Welcome back, {firstName}</h1>
          <p className="text-ink-2 text-sm mt-1">
            {selectedDoctor ? `Book your visit with ${selectedDoctor.name}` : "Choose a doctor to book your visit with"}
          </p>
        </div>

        {!selectedDoctor ? (
          <div className="card p-4 space-y-2">
            {doctors.map((doctor) => (
              <button
                key={doctor.id}
                type="button"
                onClick={() => setSelectedId(doctor.id)}
                className="w-full text-left rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{doctor.name}</div>
                    <div className="text-xs text-ink-3 mt-0.5">
                      {[doctor.specialization, doctor.qualification].filter(Boolean).join(" · ") || "General Physician"}
                    </div>
                    {doctor.availableDays?.length > 0 && (
                      <div className="text-xs text-ink-3 mt-0.5">Available: {doctor.availableDays.join(", ")}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={doctor.status === "Available" ? "badge-completed" : "badge-pending"}>
                      {doctor.status}
                    </span>
                    <div className="text-xs text-ink-2 mt-1">₹{doctor.consultationFee}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            {doctors.length > 1 && (
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-ink-2">
                  {selectedDoctor.name}
                  {selectedDoctor.specialization ? ` · ${selectedDoctor.specialization}` : ""}
                </span>
                <button type="button" onClick={() => setSelectedId("")} className="text-xs font-semibold text-primary">
                  Change doctor
                </button>
              </div>
            )}
            <VisitForm key={selectedDoctor.id} patient={patient} doctor={selectedDoctor} />
          </>
        )}
      </div>
    </div>
  );
}
