"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPatientByFirebaseUid } from "@/lib/db";
import { setSessionPatientId } from "@/lib/auth";
import { signIn } from "@/lib/firebaseAuth";

const FIREBASE_ERROR_MESSAGES = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
};

export default function PatientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const credential = await signIn(email, password);
      const patient = await getPatientByFirebaseUid(credential.user.uid);
      if (!patient) {
        setError("No patient profile found for this account. Please register.");
        return;
      }
      setSessionPatientId(patient.id);
      router.push("/dashboard");
    } catch (err) {
      setError(FIREBASE_ERROR_MESSAGES[err.code] || err.message || "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary items-center justify-center text-white text-2xl font-bold mb-3">M</div>
          <h1 className="text-2xl font-bold text-ink">Patient Portal</h1>
          <p className="text-ink-2 text-sm mt-1">Sign in with your email and password.</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div>
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="form-input" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p className="text-xs text-rejected-text mt-1">{error}</p>}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
          <p className="text-center text-sm text-ink-3">New patient? <Link href="/register" className="text-primary font-semibold">Register here</Link></p>
        </form>
      </div>
    </div>
  );
}
