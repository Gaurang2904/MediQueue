"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getVisit, getPatientById, getConsultationForVisit, updateVisitStatus } from "@/lib/db";
import ConsultationForm from "@/components/ConsultationForm";

function ConsultationContent() {
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId");
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);
  const [consultation, setConsultation] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!visitId) return;
    let v = getVisit(visitId);
    if (!v) {
      setNotFound(true);
      return;
    }
    if (v.status === "waiting") {
      v = updateVisitStatus(v.id, "in-consultation");
    }
    setVisit(v);
    setPatient(getPatientById(v.patientId));
    setConsultation(getConsultationForVisit(v.id));
  }, [visitId]);

  if (notFound) return <p className="text-sm text-ink-3">Visit not found.</p>;
  if (!visit) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Consultation — {patient?.name}</h1>
        <p className="text-ink-2 text-sm">{visit.date} · {visit.illness} · Token #{visit.queueNumber}</p>
      </div>
      <ConsultationForm visit={visit} consultation={consultation} />
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
