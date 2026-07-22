"use client";

import { useEffect, useState } from "react";
import { getSessionDoctorId } from "@/lib/auth";
import { getTransactionMetrics } from "@/lib/db";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom Range" },
];

export default function TransactionsPage() {
  const [range, setRange] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (range === "custom" && (!from || !to)) return;
    const doctorId = getSessionDoctorId();
    if (!doctorId) return;
    setMetrics(getTransactionMetrics(doctorId, { range, from, to }));
  }, [range, from, to]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Transaction Dashboard</h1>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={range === r.key ? "btn-primary" : "btn-outline"}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex gap-3 items-end">
          <div>
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5 text-center">
            <div className="text-2xl font-bold text-ink">{metrics.totalAppointments}</div>
            <div className="text-xs text-ink-3 mt-1">Total Appointments</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-2xl font-bold text-accent-dark">₹{metrics.totalRevenue}</div>
            <div className="text-xs text-ink-3 mt-1">Total Revenue</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-2xl font-bold text-completed-text">{metrics.paidPatients}</div>
            <div className="text-xs text-ink-3 mt-1">Paid Patients</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-2xl font-bold text-pending-text">{metrics.pendingPayments}</div>
            <div className="text-xs text-ink-3 mt-1">Pending Payments</div>
          </div>
        </div>
      )}
    </div>
  );
}
