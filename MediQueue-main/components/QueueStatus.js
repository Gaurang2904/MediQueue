"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQueueStatus } from "@/lib/db";

export default function QueueStatus({ visitId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      const result = getQueueStatus(visitId);
      if (result && !cancelled) setStatus(result);
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visitId]);

  if (!status) return <p className="text-sm text-ink-3">Loading queue status...</p>;

  if (status.visitStatus === "awaiting-payment") {
    return (
      <div className="flex items-center justify-between text-sm">
        <span>Your consultation is complete. Payment is pending.</span>
        <Link href={`/payment?visitId=${visitId}`} className="btn-primary">Go to Payment</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
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
