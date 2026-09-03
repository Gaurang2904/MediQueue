"use client";

import { useState } from "react";
import { verifyPayment } from "@/lib/db";

export default function VerifyPaymentButton({ visitId, onVerified }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDone() {
    setLoading(true);
    setError("");
    try {
      const result = await verifyPayment(visitId);
      if (result) {
        onVerified?.(result);
      } else {
        setError("Could not verify this payment. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Could not verify this payment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={handleDone} className="btn-accent w-full" disabled={loading}>
        {loading ? "Confirming..." : "Done"}
      </button>
      {error && <p className="text-sm text-rejected-text mt-2">{error}</p>}
    </>
  );
}
