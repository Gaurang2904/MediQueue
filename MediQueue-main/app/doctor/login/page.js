"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkDoctorLogin } from "@/lib/db";
import { setSessionDoctorId } from "@/lib/auth";

export default function DoctorLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const doctor = checkDoctorLogin(username, password);
      if (!doctor) {
        setError("Invalid username or password");
        return;
      }
      setSessionDoctorId(doctor.id);
      router.push("/doctor/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-sidebar items-center justify-center text-white text-2xl font-bold mb-3">M</div>
          <h1 className="text-2xl font-bold text-ink">Doctor Login</h1>
          <p className="text-ink-2 text-sm mt-1">Access your consultation dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="form-label" htmlFor="username">Username</label>
            <input id="username" className="form-input" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="form-input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-rejected-text">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-xs text-ink-3 text-center">Demo credentials: drayesha / doctor123</p>
        </form>
      </div>
    </div>
  );
}
