"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getConsultationForVisit, getDoctor, getPaymentForVisit, getVisit } from "@/lib/db";
import LoadingState from "@/components/LoadingState";
import StatusBadge from "@/components/StatusBadge";
import { useCurrentPatient } from "@/hooks/useCurrentPatient";

function formatAmount(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function MedicineSection({ title, medicines }) {
  return (
    <div>
      <h3 className="font-semibold text-ink">{title}</h3>
      {medicines.length === 0 ? (
        <p className="text-sm text-ink-3 mt-1">None prescribed.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {medicines.map((medicine, index) => (
            <li key={`${medicine.name}-${index}`} className="text-sm border-b border-border pb-2 last:border-0">
              <span className="font-medium text-ink">{medicine.name}</span>
              {(medicine.dosage || medicine.duration) && <span className="text-ink-3"> · {[medicine.dosage, medicine.duration].filter(Boolean).join(" · ")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequiredTestsSection({ tests }) {
  return (
    <div>
      <h3 className="font-semibold text-ink">Required Tests</h3>
      {tests.length === 0 ? (
        <p className="text-sm text-ink-3 mt-1">No tests prescribed.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tests.map((test, index) => (
            <li key={`${test.name}-${index}`} className="text-sm border-b border-border pb-2 last:border-0">
              <span className="font-medium text-ink">{test.name}</span>
              {test.instructions && <span className="text-ink-3"> · {test.instructions}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VisitRecordContent() {
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId");
  const { patient, error: patientError } = useCurrentPatient();
  const [record, setRecord] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patient || !visitId) return;
    let cancelled = false;
    (async () => {
      try {
        const [visit, consultation, payment] = await Promise.all([
          getVisit(visitId),
          getConsultationForVisit(visitId),
          getPaymentForVisit(visitId),
        ]);
        if (cancelled) return;
        if (!visit || visit.patientId !== patient.id || !consultation || !payment) {
          setNotFound(true);
          return;
        }
        const doctor = await getDoctor(visit.doctorId);
        if (!cancelled) setRecord({ visit, consultation, payment, doctor });
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load your bill and prescription. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patient, visitId]);

  if (patientError || error) return <p className="text-sm text-rejected-text text-center">{patientError || error}</p>;
  if (!patient) return <div className="min-h-screen flex items-center justify-center px-4"><LoadingState label="Loading your record..." /></div>;
  if (!visitId || notFound) return <p className="text-sm text-ink-3 text-center">This bill and prescription could not be found.</p>;
  if (!record) return <div className="min-h-screen flex items-center justify-center px-4"><LoadingState label="Loading your bill and prescription..." /></div>;

  const { visit, consultation, payment, doctor } = record;
  const additionalBilling = consultation.additionalBilling || [];
  const additionalTotal = additionalBilling.reduce((total, item) => total + Number(item.amount || 0), 0);
  const fallbackConsultationFee = Math.max(0, Number(payment.amount) - additionalTotal);
  const fallbackBill = {
    clinicName: doctor?.clinicName || doctor?.name || "Clinic",
    clinicAddress: doctor?.clinicAddress || "",
    doctorName: doctor?.name || "",
    doctorPhone: doctor?.phone || "",
    gstin: doctor?.gstin || null,
    consultationFee: fallbackConsultationFee,
    issuedAt: payment.createdAt,
  };
  const bill = { ...fallbackBill, ...(payment.billSnapshot || {}) };
  const snapshotFee = Number(bill.consultationFee);
  const consultationFee = Number.isFinite(snapshotFee) ? snapshotFee : fallbackConsultationFee;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="text-sm font-semibold text-primary">← Back to dashboard</Link>
        <StatusBadge status={payment.status} />
      </div>

      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap gap-6 justify-between border-b border-border pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Medical Bill</p>
            <h1 className="text-2xl font-bold text-ink">{bill.clinicName}</h1>
            {bill.clinicAddress && <p className="text-sm text-ink-2 mt-1 whitespace-pre-line">{bill.clinicAddress}</p>}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Date</p>
            <p className="font-semibold text-ink">{formatDate(bill.issuedAt)}</p>
            <p className="text-xs text-ink-3 mt-1">Visit: {visit.date}</p>
          </div>
        </div>

        <div className="py-5 border-b border-border text-sm space-y-1">
          <p><span className="text-ink-3">Doctor:</span> <span className="font-medium text-ink">{bill.doctorName}</span></p>
          {bill.doctorPhone && <p><span className="text-ink-3">Mobile:</span> <span className="font-medium text-ink">{bill.doctorPhone}</span></p>}
          {bill.gstin && <p><span className="text-ink-3">GSTIN:</span> <span className="font-medium text-ink">{bill.gstin}</span></p>}
        </div>

        <div className="py-5">
          <div className="grid grid-cols-[1fr_auto] gap-4 text-xs font-semibold uppercase tracking-wide text-ink-3 pb-2 border-b border-border">
            <span>Billable Item</span>
            <span>Amount</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm border-b border-border">
            <span className="font-medium text-ink">Consultation Fee</span>
            <span className="font-medium text-ink">{formatAmount(consultationFee)}</span>
          </div>
          {additionalBilling.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 pt-5 pb-2">Additional Billing</p>
              {additionalBilling.map((item, index) => (
                <div key={`${item.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-4 py-2 text-sm">
                  <span className="text-ink-2">{item.name}</span>
                  <span className="text-ink">{formatAmount(item.amount)}</span>
                </div>
              ))}
            </>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-4 pt-5 mt-3 border-t border-border text-lg font-bold text-ink">
            <span>Total</span>
            <span>{formatAmount(payment.amount)}</span>
          </div>
        </div>
      </section>

      <section className="card p-6 sm:p-8 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Prescription</p>
          <h2 className="text-2xl font-bold text-ink">Prescribed for your visit</h2>
        </div>
        <MedicineSection title="Clinic Medicines" medicines={consultation.clinicMedicines || []} />
        <MedicineSection title="Outside Medicines" medicines={consultation.outsideMedicines || []} />
        <RequiredTestsSection tests={consultation.requiredTests || []} />
      </section>
    </div>
  );
}

export default function VisitRecordPage() {
  return (
    <Suspense fallback={null}>
      <VisitRecordContent />
    </Suspense>
  );
}
