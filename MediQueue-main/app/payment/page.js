"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getVisit, getPaymentForVisit, getDoctor } from "@/lib/db";
import PaymentPanel from "@/components/PaymentPanel";
import LoadingState from "@/components/LoadingState";

function PaymentContent() {
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId");
  const [visit, setVisit] = useState(null);
  const [payment, setPayment] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await getVisit(visitId);
        if (cancelled) return;
        if (!v) {
          setNotFound(true);
          return;
        }
        setVisit(v);
        setPayment(await getPaymentForVisit(visitId));
        setDoctor(await getDoctor(v.doctorId));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load payment details. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  if (error) return <p className="text-sm text-rejected-text text-center">{error}</p>;
  if (notFound) return <p className="text-sm text-ink-3 text-center">Visit not found.</p>;
  if (!visitId) return <p className="text-sm text-ink-3 text-center">Missing visit reference. Please go back to your dashboard and try again.</p>;
  if (!visit) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState label="Loading payment details..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink text-center mb-6">Payment</h1>
        {!payment ? (
          <div className="card p-6 text-center text-sm text-ink-2">
            Your consultation isn&apos;t complete yet. Payment details will appear here once the doctor finishes your consultation.
          </div>
        ) : (
          <PaymentPanel visit={visit} payment={payment} doctor={doctor} />
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={null}>
      <PaymentContent />
    </Suspense>
  );
}
