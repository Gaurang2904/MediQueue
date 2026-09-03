"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDoctorDashboard, todayStr } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import DoctorStatusToggle from "@/components/DoctorStatusToggle";
import LoadingState from "@/components/LoadingState";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { subscribeToTableChanges } from "@/lib/realtime";

function VisitRow({ v }) {
  return (
    <li className="flex items-center justify-between text-sm border-b border-border pb-2">
      <div>
        <span className="font-semibold">#{v.visit.queueNumber}</span> {v.patient?.name || "Unknown"} · {v.visit.slot}
        {v.visit.isWalkIn && <span className="ml-2 badge-pending">Walk-in</span>}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={v.visit.status} />
        <Link href={`/doctor/patient?patientId=${v.visit.patientId}`} className="text-primary text-xs font-semibold">View</Link>
      </div>
    </li>
  );
}

export default function DoctorDashboardPage() {
  const doctor = useCurrentDoctor();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const date = todayStr();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const dash = await getDoctorDashboard(doctor.id, date);
        if (!cancelled) setDashboard(dash);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load your dashboard. Please refresh the page.");
      }
    }
    load();

    // Live updates: a walk-in registered from the registration-desk portal (or this
    // doctor's own patients page) shows up here without a manual refresh -- just
    // re-runs the same load() above on any change (see lib/realtime.js). Degrades
    // silently to "no live updates" if Realtime isn't enabled on the Supabase
    // project yet -- the initial load() still runs regardless.
    const unsubscribeVisits = subscribeToTableChanges({
      table: "visits",
      filter: `doctor_id=eq.${doctor.id}`,
      onChange: load,
    });
    const unsubscribePayments = subscribeToTableChanges({
      table: "payments",
      onChange: load,
    });

    return () => {
      cancelled = true;
      unsubscribeVisits();
      unsubscribePayments();
    };
  }, [doctor.id, date]);

  if (error) return <p className="text-sm text-rejected-text">{error}</p>;
  if (!dashboard) return <LoadingState label="Loading your dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Today&apos;s Dashboard</h1>
          <p className="text-ink-2 text-sm">{date}</p>
        </div>
        <DoctorStatusToggle doctorId={doctor.id} status={doctor.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-tile">
          <div className="stat-tile-value">{dashboard.all.length}</div>
          <div className="stat-tile-label">Today&apos;s Appointments</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{dashboard.waiting.length}</div>
          <div className="stat-tile-label">Waiting in Queue</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{dashboard.completed.length}</div>
          <div className="stat-tile-label">Completed</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{dashboard.pendingPayments.length}</div>
          <div className="stat-tile-label">Pending Payments</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Today&apos;s Appointments ({dashboard.all.length})</h2>
          <ul className="space-y-2">
            {dashboard.all.map((v) => <VisitRow key={v.visit.id} v={v} />)}
            {dashboard.all.length === 0 && <p className="text-sm text-ink-3">No appointments today.</p>}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Ongoing Queue ({dashboard.waiting.length})</h2>
          <ul className="space-y-2">
            {dashboard.waiting.map((v) => <VisitRow key={v.visit.id} v={v} />)}
            {dashboard.waiting.length === 0 && <p className="text-sm text-ink-3">No one waiting.</p>}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Walk-in Patients ({dashboard.walkIns.length})</h2>
          <ul className="space-y-2">
            {dashboard.walkIns.map((v) => <VisitRow key={v.visit.id} v={v} />)}
            {dashboard.walkIns.length === 0 && <p className="text-sm text-ink-3">No walk-ins today.</p>}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Completed Consultations ({dashboard.completed.length})</h2>
          <ul className="space-y-2">
            {dashboard.completed.map((v) => <VisitRow key={v.visit.id} v={v} />)}
            {dashboard.completed.length === 0 && <p className="text-sm text-ink-3">None completed yet.</p>}
          </ul>
        </div>

        <div className="card p-5 md:col-span-2">
          <h2 className="font-semibold text-ink mb-3">Pending Payments ({dashboard.pendingPayments.length})</h2>
          <ul className="space-y-2">
            {dashboard.pendingPayments.map((v) => (
              <li key={v.visit.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <span>{v.patient?.name} · ₹{v.payment.amount} · {v.payment.mode}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={v.payment.status} />
                  <Link href={`/doctor/payment?visitId=${v.visit.id}`} className="text-primary text-xs font-semibold">Verify</Link>
                </div>
              </li>
            ))}
            {dashboard.pendingPayments.length === 0 && <p className="text-sm text-ink-3">Nothing pending.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
