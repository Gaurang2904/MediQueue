"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQueueStatus } from "@/lib/db";

export default function QueueStatus({ visitId }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let interval = null;

    async function poll() {
      try {
        const result = await getQueueStatus(visitId);
        if (cancelled) return;
        if (result) {
          setStatus(result);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Couldn't load your queue status.");
      }
    }

    function startPolling() {
      if (interval) return;
      poll();
      interval = setInterval(poll, 5000);
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    // Don't keep polling every 5s while the tab is backgrounded.
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        startPolling();
      }
    }

    if (document.visibilityState !== "hidden") startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [visitId]);

  if (!status && error) return <p className="text-sm text-rejected-text">{error}</p>;
  if (!status) return <p className="text-sm text-ink-3">Loading queue status...</p>;

  if (status.visitStatus === "awaiting-payment") {
    return (
      <div className="flex items-center justify-between text-sm" aria-live="polite">
        <span>Your consultation is complete. Payment is pending.</span>
        <Link href={`/payment?visitId=${visitId}`} className="btn-primary">Go to Payment</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 text-center" aria-live="polite">
      <div>
        <div className="text-2xl font-bold text-primary">#{status.queueNumber}</div>
        <div className="text-xs text-ink-3">Your Token</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-ink">{status.patientsAhead}</div>
        <div className="text-xs text-ink-3">Patients Ahead</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-ink">{status.estimatedWaitMinutes}m</div>
        <div className="text-xs text-ink-3">Est. Wait · Doctor {status.doctorStatus}</div>
      </div>
    </div>
  );
}
