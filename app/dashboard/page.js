"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsultationHistoryForPatient, getPendingDuesForPatient } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import QueueStatus from "@/components/QueueStatus";
import HealthProfileCard from "@/components/HealthProfileCard";
import LogoutButton from "@/components/LogoutButton";
import LoadingState from "@/components/LoadingState";
import { useCurrentPatient } from "@/hooks/useCurrentPatient";

export default function DashboardPage() {
  const { patient, error: patientError } = useCurrentPatient();
  const [history, setHistory] = useState([]);
  const [pendingDues, setPendingDues] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    (async () => {
      try {
        setHistory(await getConsultationHistoryForPatient(patient.id));
        setPendingDues(await getPendingDuesForPatient(patient.id));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load your dashboard. Please refresh the page.");
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

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState label="Loading your dashboard..." />
      </div>
    );
  }

  const active = history.filter((h) => !h.consultation && h.visit.status !== "cancelled");
  const previous = history.filter((h) => h.consultation);
  const currentVisit = active[0]?.visit;

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Hi, {patient.name.split(" ")[0]}</h1>
          <p className="text-ink-2 text-sm">Your patient dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/visit/new" className="btn-primary">Book a Visit</Link>
          <LogoutButton redirectTo="/" className="text-sm font-medium text-ink-2 hover:text-ink" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-tile">
          <div className="stat-tile-value">{history.length}</div>
          <div className="stat-tile-label">Total Visits</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{active.length}</div>
          <div className="stat-tile-label">Upcoming</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{history.filter((h) => h.consultation).length}</div>
          <div className="stat-tile-label">Consultations</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">₹{pendingDues}</div>
          <div className="stat-tile-label">Pending Dues</div>
        </div>
      </div>

      {currentVisit && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Queue Position</h2>
          <QueueStatus visitId={currentVisit.id} />
        </div>
      )}

      <HealthProfileCard patient={patient} />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Upcoming Appointments</h2>
          {active.length === 0 && <p className="text-sm text-ink-3">No upcoming appointments.</p>}
          <ul className="space-y-2">
            {active.map(({ visit }) => (
              <li key={visit.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <span>{visit.date} · {visit.slot} · {visit.illness}</span>
                <StatusBadge status={visit.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Previous Appointments</h2>
          {previous.length === 0 && <p className="text-sm text-ink-3">No past appointments yet.</p>}
          <ul className="space-y-2">
            {previous.map(({ visit }) => (
              <li key={visit.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <div>
                  <div>{visit.date} · {visit.illness}</div>
                  <Link href={`/visit/record?visitId=${visit.id}`} className="text-xs font-semibold text-primary">View Bill &amp; Prescription</Link>
                </div>
                <StatusBadge status={visit.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Consultation History</h2>
          {history.filter((h) => h.consultation).length === 0 && (
            <p className="text-sm text-ink-3">No consultations recorded yet.</p>
          )}
          <ul className="space-y-3">
            {history
              .filter((h) => h.consultation)
              .map(({ visit, consultation }) => (
                <li key={visit.id} className="text-sm border-b border-border pb-2">
                  <div className="font-medium">{visit.date} — {consultation.diagnosisNotes || "No notes"}</div>
                  <div className="text-ink-3 text-xs">Symptoms: {consultation.symptoms || "—"}</div>
                  <div className="text-ink-3 text-xs">Required tests: {consultation.requiredTests?.map((test) => test.name).join(", ") || "—"}</div>
                  <div className="text-ink-3 text-xs">Additional billing: {consultation.additionalBilling?.map((item) => `${item.name} (₹${item.amount})`).join(", ") || "—"}</div>
                </li>
              ))}
          </ul>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">Payment History</h2>
            <span className="text-xs font-semibold text-ink-2">Pending dues: ₹{pendingDues}</span>
          </div>
          {history.filter((h) => h.payment).length === 0 && (
            <p className="text-sm text-ink-3">No payments recorded yet.</p>
          )}
          <ul className="space-y-2">
            {history
              .filter((h) => h.payment)
              .map(({ visit, payment }) => (
                <li key={visit.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                  <span>{visit.date} · ₹{payment.amount} · {payment.mode}</span>
                  <StatusBadge status={payment.status} />
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
