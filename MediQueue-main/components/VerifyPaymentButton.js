"use client";

import { useState } from "react";
import { verifyPayment } from "@/lib/db";

export default function VerifyPaymentButton({ visitId, onVerified }) {
  const [loading, setLoading] = useState(false);

  async function handleDone() {
    setLoading(true);
    try {
      const result = verifyPayment(visitId);
      if (result) onVerified?.(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleDone} className="btn-accent w-full" disabled={loading}>
      {loading ? "Confirming..." : "Done"}
    </button>
  );
}
