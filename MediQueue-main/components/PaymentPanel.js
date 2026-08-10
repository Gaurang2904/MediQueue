"use client";

import { useState } from "react";
import { uploadPaymentScreenshot } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";

export default function PaymentPanel({ visit, payment, doctor }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(payment.status);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const updated = await uploadPaymentScreenshot(visit.id, dataUrl);
      if (!updated) {
        setError("Upload failed.");
        return;
      }
      setStatus(updated.status);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-ink-2 text-sm">Amount Payable</span>
        <span className="text-2xl font-bold text-ink">₹{payment.amount}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-2">Status</span>
        <StatusBadge status={status} />
      </div>

      {payment.mode === "online" ? (
        doctor ? (
          <div className="text-center space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={doctor.qrCodeUrl} alt="Payment QR code" className="mx-auto w-40 h-40 border border-border rounded-lg" />
            <p className="text-xs text-ink-3">Scan the QR code with any UPI app to pay {doctor.name}, then upload your payment screenshot below.</p>
            <label className="form-label" htmlFor="payment-screenshot">Upload Payment Screenshot</label>
            <input id="payment-screenshot" type="file" accept="image/*" className="form-input" onChange={handleUpload} disabled={uploading || status !== "pending"} />
            {error && <p className="text-sm text-rejected-text">{error}</p>}
            {status !== "pending" && <p className="text-sm text-completed-text">Screenshot received. Awaiting doctor verification.</p>}
          </div>
        ) : (
          <p className="text-sm text-rejected-text text-center">Doctor details unavailable. Please contact the clinic to complete payment.</p>
        )
      ) : (
        <p className="text-sm text-ink-2 text-center">Please pay ₹{payment.amount} in cash at the counter. The doctor will confirm once received.</p>
      )}
    </div>
  );
}
