"use client";

import { useState } from "react";
import { uploadPaymentScreenshot, markCashPaymentAwaitingVerification } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { fileToCompressedDataUrl } from "@/lib/image";

export default function PaymentPanel({ visit, payment, doctor, consultation }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(payment.status);
  const [mode, setMode] = useState(payment.mode);
  const [screenshot, setScreenshot] = useState(payment.screenshotDataUrl || "");
  // Purely local: a patient who booked as cash choosing to settle online instead. The
  // mode change isn't persisted until the screenshot upload carries it (see
  // uploadPaymentScreenshot in lib/db.js for why it can't be its own write).
  const [payOnline, setPayOnline] = useState(false);
  const [error, setError] = useState("");

  const additionalBilling = consultation?.additionalBilling || [];
  const additionalBillingTotal = additionalBilling.reduce((total, item) => total + Number(item.amount || 0), 0);
  const consultationFee = Math.max(0, Number(payment.amount) - additionalBillingTotal);

  const isVerified = status === "verified";
  const isSubmitted = status === "awaiting-verification";
  const canPayOnline = Boolean(doctor?.qrCodeUrl);
  const showOnlineFlow = mode === "online" || payOnline;

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      // Downscaled before encoding -- this lands in payments.screenshot_data_url as
      // base64, so an unresized phone photo would put ~6.7 MB in the row that every
      // later payment query reads back.
      const dataUrl = await fileToCompressedDataUrl(file);
      const updated = await uploadPaymentScreenshot(visit.id, dataUrl);
      if (!updated) {
        setError("Upload failed. Please try again.");
        return;
      }
      setStatus(updated.status);
      setMode(updated.mode);
      setScreenshot(updated.screenshotDataUrl || dataUrl);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCashPaid() {
    setBusy(true);
    setError("");
    try {
      const updated = await markCashPaymentAwaitingVerification(visit.id);
      if (!updated) {
        setError("Could not update your payment. Please try again.");
        return;
      }
      setStatus(updated.status);
    } catch (err) {
      setError(err.message || "Could not update your payment. Please try again.");
    } finally {
      setBusy(false);
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

      {/* What the patient already sent, so they can confirm it arrived and swap a
          blurry or wrong screenshot while the doctor hasn't verified it yet. */}
      {screenshot && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="form-label">Your Payment Screenshot</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshot} alt="Your uploaded payment screenshot" className="w-full rounded-lg border border-border bg-white" />
          {!isVerified && (
            <>
              <label className="btn-outline cursor-pointer inline-block" htmlFor="payment-screenshot-replace">
                {busy ? "Uploading..." : "Replace screenshot"}
              </label>
              <input id="payment-screenshot-replace" type="file" accept="image/*" className="sr-only" onChange={handleUpload} disabled={busy} />
            </>
          )}
        </div>
      )}

      {isVerified ? (
        <p className="text-sm text-completed-text text-center">Payment verified. Your appointment is complete.</p>
      ) : !doctor ? (
        <p className="text-sm text-rejected-text text-center">Doctor details unavailable. Please contact the clinic to complete payment.</p>
      ) : showOnlineFlow && canPayOnline ? (
        <div className="text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doctor.qrCodeUrl} alt={`Payment QR code for ${doctor.name}`} className="mx-auto w-40 h-40 object-contain border border-border rounded-lg bg-white" />
          <p className="text-xs text-ink-3">
            Scan the QR code with any UPI app to pay {doctor.name}, then upload your payment screenshot below.
          </p>
          {!screenshot && (
            <div>
              <label className="form-label" htmlFor="payment-screenshot">Upload Payment Screenshot</label>
              <input id="payment-screenshot" type="file" accept="image/*" className="form-input" onChange={handleUpload} disabled={busy} />
            </div>
          )}
          {isSubmitted && <p className="text-sm text-completed-text">Screenshot received. Awaiting doctor verification.</p>}
          {mode !== "online" && !isSubmitted && (
            <button type="button" onClick={() => setPayOnline(false)} className="text-xs font-semibold text-primary">
              Pay in cash instead
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-center">
          {showOnlineFlow && !canPayOnline ? (
            // A doctor who hasn't uploaded a QR yet (Doctor Dashboard -> Profile ->
            // Payment QR Code). This used to render a broken <img> with an upload box
            // under it, inviting a screenshot of a payment the patient couldn't make.
            <p className="text-sm text-ink-2">
              {doctor.name} hasn&apos;t set up online payments yet. Please pay ₹{payment.amount} in cash at the counter.
            </p>
          ) : (
            <p className="text-sm text-ink-2">
              Please pay ₹{payment.amount} in cash at the counter. The doctor will confirm once received.
            </p>
          )}

          {isSubmitted ? (
            <p className="text-sm text-completed-text">Marked as paid. Awaiting doctor verification.</p>
          ) : (
            <button type="button" onClick={handleCashPaid} className="btn-primary w-full" disabled={busy}>
              {busy ? "Saving..." : "I've paid in cash"}
            </button>
          )}

          {canPayOnline && !isSubmitted && (
            <button type="button" onClick={() => setPayOnline(true)} className="text-xs font-semibold text-primary">
              Pay online instead
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-rejected-text text-center">{error}</p>}
    </div>
  );
}
