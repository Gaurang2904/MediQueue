"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getVisit, getPatientById, getConsultationForVisit, updateVisitStatus } from "@/lib/db";
import ConsultationForm from "@/components/ConsultationForm";
import LoadingState from "@/components/LoadingState";

function ConsultationContent() {
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId");
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);
  const [consultation, setConsultation] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    (async () => {
      try {
        let v = await getVisit(visitId);
        if (cancelled) return;
        if (!v) {
          setNotFound(true);
          return;
        }
        if (v.status !== "waiting" && v.status !== "in-consultation") {
          setVisit(v);
          setLocked(true);
          return;
        }
        if (v.status === "waiting") {
          v = await updateVisitStatus(v.id, "in-consultation");
        }
        if (cancelled) return;
        // Fetch patient + consultation before committing any state, so ConsultationForm
        // never mounts with a still-loading (null) patient/consultation — its fields are
        // initialized from these props only once, at mount.
        const [p, c] = await Promise.all([getPatientById(v.patientId), getConsultationForVisit(v.id)]);
        if (cancelled) return;
        setVisit(v);
        setPatient(p);
        setConsultation(c);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load this consultation. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  if (error) return <p className="text-sm text-rejected-text">{error}</p>;
  if (notFound) return <p className="text-sm text-ink-3">Visit not found.</p>;
  if (locked) {
    return (
      <p className="text-sm text-ink-3">
        This consultation is already {visit?.status === "cancelled" ? "cancelled" : "completed"} and can no longer be edited.
      </p>
    );
  }
  if (!visitId) return <p className="text-sm text-ink-3">Missing visit reference.</p>;
  if (!visit) return <LoadingState label="Loading consultation..." />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Consultation — {patient?.name}</h1>
        <p className="text-ink-2 text-sm">{visit.date} · {visit.illness} · Token #{visit.queueNumber}</p>
      </div>
      <ConsultationForm visit={visit} patient={patient} consultation={consultation} />
    </div>
  );
}

export default function ConsultationPage() {
  return (
    <Suspense fallback={null}>
      <ConsultationContent />
    </Suspense>
  );
}
