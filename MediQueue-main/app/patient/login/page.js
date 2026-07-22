"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPatientByContact } from "@/lib/db";
import { setSessionPatientId } from "@/lib/auth";

export default function PatientLoginPage() {
  const router = useRouter();
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    const number = contact.trim();
    if (!/^\d{10}$/.test(number)) {
      setError("Enter a valid 10-digit contact number.");
      return;
    }

    setLoading(true);
    const patient = getPatientByContact(number);
    if (!patient) {
      router.push(`/register?contact=${encodeURIComponent(number)}`);
      return;
    }
    setSessionPatientId(patient.id);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary items-center justify-center text-white text-2xl font-bold mb-3">M</div>
          <h1 className="text-2xl font-bold text-ink">Patient Portal</h1>
          <p className="text-ink-2 text-sm mt-1">Sign in with your registered mobile number.</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="form-label" htmlFor="contact">Registered Contact Number</label>
            <input id="contact" type="tel" maxLength={10} placeholder="10-digit mobile number" className="form-input" value={contact} onChange={(event) => setContact(event.target.value.replace(/\D/g, ""))} required />
            {error && <p className="text-xs text-rejected-text mt-1">{error}</p>}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
          <p className="text-center text-sm text-ink-3">New patient? <Link href="/register" className="text-primary font-semibold">Register here</Link></p>
        </form>
      </div>
    </div>
  );
}
