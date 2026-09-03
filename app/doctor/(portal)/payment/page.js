"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getVisit, getPatientById, getPaymentForVisit } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import VerifyPaymentButton from "@/components/VerifyPaymentButton";
import LoadingState from "@/components/LoadingState";

function DoctorPaymentContent() {
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId");
  const [patient, setPatient] = useState(null);
  const [payment, setPayment] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    (async () => {
      try {
        const visit = await getVisit(visitId);
        const p = visit ? await getPaymentForVisit(visitId) : null;
        if (cancelled) return;
        if (!visit || !p) {
          setNotFound(true);
          return;
        }
        setPatient(await getPatientById(visit.patientId));
        setPayment(p);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load payment details. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  if (error) return <p className="text-sm text-rejected-text">{error}</p>;
  if (notFound) return <p className="text-sm text-ink-3">Payment not found.</p>;
  if (!visitId) return <p className="text-sm text-ink-3">Missing visit reference.</p>;
  if (!payment) return <LoadingState label="Loading payment details..." />;

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-ink">Verify Payment</h1>
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">Patient</span>
          <span className="font-medium">{patient?.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">Amount</span>
          <span className="font-medium">₹{payment.amount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">Mode</span>
          <span className="font-medium capitalize">{payment.mode}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">Status</span>
          <StatusBadge status={payment.status} />
        </div>
        {payment.screenshotDataUrl && (
          <div>
            <p className="form-label">Payment Screenshot</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={payment.screenshotDataUrl} alt="Payment screenshot" className="w-full rounded-lg border border-border" />
          </div>
        )}
        {payment.status !== "verified" ? (
          <VerifyPaymentButton visitId={visitId} onVerified={(result) => setPayment(result.payment)} />
        ) : (
          <p className="text-sm text-completed-text">Payment verified. Appointment closed.</p>
        )}
      </div>
    </div>
  );
}

export default function DoctorPaymentPage() {
  return (
    <Suspense fallback={null}>
      <DoctorPaymentContent />
    </Suspense>
  );
}
