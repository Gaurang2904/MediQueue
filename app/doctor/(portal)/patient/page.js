"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getPatientById, getConsultationHistoryForPatient } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import HealthProfileCard from "@/components/HealthProfileCard";
import LoadingState from "@/components/LoadingState";

function DoctorPatientContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getPatientById(patientId);
        if (cancelled) return;
        if (!p) {
          setNotFound(true);
          return;
        }
        setPatient(p);
        setHistory(await getConsultationHistoryForPatient(patientId));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load patient record. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (error) return <p className="text-sm text-rejected-text">{error}</p>;
  if (notFound) return <p className="text-sm text-ink-3">Patient not found.</p>;
  if (!patientId) return <p className="text-sm text-ink-3">Missing patient reference.</p>;
  if (!patient) return <LoadingState label="Loading patient record..." />;

  return (
    <div className="space-y-6">
      <div className="card p-5 flex items-start gap-4">
        {patient.photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={patient.photoDataUrl} alt={patient.name} className="w-20 h-20 rounded-lg object-cover border border-border" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-ink-3 text-xs">No photo</div>
        )}
        <div>
          <h1 className="text-xl font-bold text-ink">{patient.name}</h1>
          <p className="text-sm text-ink-2">{patient.age} yrs · {patient.gender}</p>
          <p className="text-sm text-ink-2">{patient.contact}</p>
          <p className="text-sm text-ink-3">{patient.address}</p>
        </div>
      </div>

      <HealthProfileCard patient={patient} />

      <div className="card p-5">
        <h2 className="font-semibold text-ink mb-3">Patient History & Doctor Reviews (most recent first)</h2>
        <ul className="space-y-4">
          {history.map(({ visit, consultation, payment }) => (
            <li key={visit.id} className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{visit.date} · {visit.illness}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={visit.status} />
                  {(visit.status === "waiting" || visit.status === "in-consultation") && (
                    <Link href={`/doctor/consultation?visitId=${visit.id}`} className="btn-primary text-xs px-3 py-1.5">
                      {visit.status === "in-consultation" ? "Continue Consultation" : "Start Consultation"}
                    </Link>
                  )}
                </div>
              </div>
              {consultation && (
                <div className="text-xs text-ink-2 mt-1 space-y-0.5">
                  <div>Diagnosis: {consultation.diagnosisNotes || "—"}</div>
                  <div>Clinic medicines: {consultation.clinicMedicines?.map((m) => m.name).join(", ") || "—"}</div>
                  <div>Outside medicines: {consultation.outsideMedicines?.map((m) => m.name).join(", ") || "—"}</div>
                  <div>Required tests: {consultation.requiredTests?.map((test) => test.name).join(", ") || "—"}</div>
                  <div>Additional billing: {consultation.additionalBilling?.map((item) => `${item.name} (₹${item.amount})`).join(", ") || "—"}</div>
                </div>
              )}
              {payment && (
                <div className="text-xs text-ink-3 mt-1">Payment: ₹{payment.amount} · {payment.mode} · {payment.status}</div>
              )}
            </li>
          ))}
          {history.length === 0 && <p className="text-sm text-ink-3">No visits yet.</p>}
        </ul>
      </div>
    </div>
  );
}

export default function DoctorPatientPage() {
  return (
    <Suspense fallback={null}>
      <DoctorPatientContent />
    </Suspense>
  );
}
