"use client";

import { useState } from "react";
import { uploadPaymentScreenshot } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { fileToCompressedDataUrl } from "@/lib/image";

export default function PaymentPanel({ visit, payment, doctor, consultation }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(payment.status);
  const [error, setError] = useState("");
  const additionalBilling = consultation?.additionalBilling || [];
  const additionalBillingTotal = additionalBilling.reduce((total, item) => total + Number(item.amount || 0), 0);
  const consultationFee = Math.max(0, Number(payment.amount) - additionalBillingTotal);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      // Downscaled before encoding -- this lands in payments.screenshot_data_url as
      // base64, so an unresized phone photo would put ~6.7 MB in the row that every
      // later payment query reads back.
      const dataUrl = await fileToCompressedDataUrl(file);
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
      {additionalBilling.length > 0 && (
        <div className="border-t border-border pt-3 text-sm space-y-2">
          <div className="flex items-center justify-between text-ink-2">
            <span>Consultation Fee</span>
            <span>₹{consultationFee}</span>
          </div>
          {additionalBilling.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex items-center justify-between text-ink-2">
              <span>{item.name}</span>
              <span>₹{item.amount}</span>
            </div>
          ))}
        </div>
      )}

      {payment.mode === "online" ? (
        !doctor ? (
          <p className="text-sm text-rejected-text text-center">Doctor details unavailable. Please contact the clinic to complete payment.</p>
        ) : !doctor.qrCodeUrl ? (
          // A doctor who hasn't uploaded a QR yet (Doctor Dashboard -> Profile -> Payment
          // QR Code) used to render a broken <img> here with an upload box under it,
          // inviting a screenshot of a payment the patient had no way to make.
          <p className="text-sm text-ink-2 text-center">
            {doctor.name} hasn&apos;t set up online payments yet. Please pay ₹{payment.amount} in cash at the counter.
          </p>
        ) : (
          <div className="text-center space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={doctor.qrCodeUrl} alt={`Payment QR code for ${doctor.name}`} className="mx-auto w-40 h-40 object-contain border border-border rounded-lg bg-white" />
            <p className="text-xs text-ink-3">Scan the QR code with any UPI app to pay {doctor.name}, then upload your payment screenshot below.</p>
            <label className="form-label" htmlFor="payment-screenshot">Upload Payment Screenshot</label>
            <input id="payment-screenshot" type="file" accept="image/*" className="form-input" onChange={handleUpload} disabled={uploading || status !== "pending"} />
            {error && <p className="text-sm text-rejected-text">{error}</p>}
            {status !== "pending" && <p className="text-sm text-completed-text">Screenshot received. Awaiting doctor verification.</p>}
          </div>
        )
      ) : (
        <p className="text-sm text-ink-2 text-center">Please pay ₹{payment.amount} in cash at the counter. The doctor will confirm once received.</p>
      )}
    </div>
  );
}
