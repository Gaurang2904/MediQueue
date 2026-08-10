"use client";

import { useEffect, useState } from "react";
import { getRegistrationQueue, registrationSetPaymentStatus, registrationSetVisitStatus, todayStr } from "@/lib/db";
import { useCurrentRegistration } from "@/hooks/useCurrentRegistration";
import StatusBadge from "@/components/StatusBadge";
import LoadingState from "@/components/LoadingState";

function PaymentRow({ entry, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const verified = entry.payment.status === "verified";

  async function setStatus(status) {
    setLoading(true);
    setError("");
    try {
      await registrationSetPaymentStatus(entry.visit.id, status);
      onChanged();
    } catch (err) {
      setError(err.message || "Could not update payment status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="py-2.5 px-3">{entry.patient?.name || "—"}</td>
      <td className="py-2.5 px-3">{entry.doctor?.name || "—"}</td>
      <td className="py-2.5 px-3">₹{entry.payment.amount}</td>
      <td className="py-2.5 px-3 capitalize">{entry.payment.mode}</td>
      <td className="py-2.5 px-3"><StatusBadge status={entry.payment.status} /></td>
      <td className="py-2.5 px-3 text-right">
        {verified ? (
          <button className="btn-outline" disabled={loading} onClick={() => setStatus("pending")}>
            {loading ? "Updating..." : "Mark Pending"}
          </button>
        ) : (
          <button className="btn-accent" disabled={loading} onClick={() => setStatus("verified")}>
            {loading ? "Verifying..." : "Mark Verified"}
          </button>
        )}
        {error && <p className="text-xs text-rejected-text mt-1">{error}</p>}
      </td>
    </tr>
  );
}

function TrackingRow({ entry, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const editable = entry.visit.status === "waiting" || entry.visit.status === "in-consultation";
  const nextStatus = entry.visit.status === "waiting" ? "in-consultation" : "waiting";
  const nextLabel = entry.visit.status === "waiting" ? "Call In" : "Move Back to Waiting";

  async function setStatus() {
    setLoading(true);
    setError("");
    try {
      await registrationSetVisitStatus(entry.visit.id, nextStatus);
      onChanged();
    } catch (err) {
      setError(err.message || "Could not update status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="py-2.5 px-3">{entry.visit.queueNumber}</td>
      <td className="py-2.5 px-3">{entry.patient?.name || "—"}</td>
      <td className="py-2.5 px-3">{entry.doctor?.name || "—"}</td>
      <td className="py-2.5 px-3"><StatusBadge status={entry.visit.status} /></td>
      <td className="py-2.5 px-3 text-right">
        {editable ? (
          <button className="btn-outline" disabled={loading} onClick={setStatus}>
            {loading ? "Updating..." : nextLabel}
          </button>
        ) : (
          <span className="text-xs text-ink-3">—</span>
        )}
        {error && <p className="text-xs text-rejected-text mt-1">{error}</p>}
      </td>
    </tr>
  );
}

export default function RegistrationDashboardPage() {
  const registration = useCurrentRegistration();
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await getRegistrationQueue(todayStr());
      setQueue(data);
    } catch (err) {
      setError(err.message || "Failed to load today's queue. Please refresh the page.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-sm text-rejected-text">{error}</p>;
  if (!queue) return <LoadingState label="Loading today's queue..." />;

  const paymentEntries = queue.filter((e) => e.payment && e.visit.status === "awaiting-payment");
  const trackingEntries = queue.filter((e) => ["waiting", "in-consultation", "awaiting-payment", "completed"].includes(e.visit.status));

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Welcome, {registration.name}</h1>
        <p className="text-ink-2 text-sm mt-1">Payment verification and patient tracking for today.</p>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold text-ink mb-4">Payment Verification</h2>
        {paymentEntries.length === 0 ? (
          <p className="text-sm text-ink-3">No payments awaiting verification.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-2 px-3 font-medium">Patient</th>
                  <th className="py-2 px-3 font-medium">Doctor</th>
                  <th className="py-2 px-3 font-medium">Amount</th>
                  <th className="py-2 px-3 font-medium">Mode</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paymentEntries.map((entry) => (
                  <PaymentRow key={entry.visit.id} entry={entry} onChanged={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold text-ink mb-4">Patient Tracking</h2>
        {trackingEntries.length === 0 ? (
          <p className="text-sm text-ink-3">No visits scheduled today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-2 px-3 font-medium">Queue #</th>
                  <th className="py-2 px-3 font-medium">Patient</th>
                  <th className="py-2 px-3 font-medium">Doctor</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {trackingEntries.map((entry) => (
                  <TrackingRow key={entry.visit.id} entry={entry} onChanged={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
