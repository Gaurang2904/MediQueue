"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getVisit, getPaymentForVisit, getDoctor } from "@/lib/db";
import PaymentPanel from "@/components/PaymentPanel";

function PaymentContent() {
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId");
  const [visit, setVisit] = useState(null);
  const [payment, setPayment] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!visitId) return;
    const v = getVisit(visitId);
    if (!v) {
      setNotFound(true);
      return;
    }
    setVisit(v);
    setPayment(getPaymentForVisit(visitId));
    setDoctor(getDoctor(v.doctorId));
  }, [visitId]);

  if (notFound) return <p className="text-sm text-ink-3 text-center">Visit not found.</p>;
  if (!visit) return null;

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
