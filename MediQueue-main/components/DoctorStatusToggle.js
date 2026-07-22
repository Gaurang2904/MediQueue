"use client";

import { useState } from "react";
import { getSessionDoctorId } from "@/lib/auth";
import { setDoctorStatus } from "@/lib/db";

export default function DoctorStatusToggle({ status }) {
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = current === "Available" ? "Busy" : "Available";
    setLoading(true);
    try {
      const doctorId = getSessionDoctorId();
      const doctor = setDoctorStatus(doctorId, next);
      if (doctor) setCurrent(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={current === "Available" ? "btn-accent" : "btn-outline"}
    >
      {current === "Available" ? "● Available" : "● Busy"}
    </button>
  );
}
