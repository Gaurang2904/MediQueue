"use client";

import { useState } from "react";
import { setDoctorStatus } from "@/lib/db";

export default function DoctorStatusToggle({ doctorId, status }) {
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const next = current === "Available" ? "Busy" : "Available";
    setLoading(true);
    setError("");
    try {
      const doctor = await setDoctorStatus(doctorId, next);
      if (doctor) {
        setCurrent(next);
      } else {
        setError("Failed to update status.");
      }
    } catch (err) {
      setError(err.message || "Failed to update status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={toggle}
        disabled={loading}
        className={current === "Available" ? "btn-accent" : "btn-outline"}
      >
        {current === "Available" ? "● Available" : "● Busy"}
      </button>
      {error && <p className="text-xs text-rejected-text mt-1">{error}</p>}
    </div>
  );
}
