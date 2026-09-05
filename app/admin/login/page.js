"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminByFirebaseUid } from "@/lib/db";
import { setSessionAdminId } from "@/lib/auth";
import { signIn } from "@/lib/firebaseAuth";

const FIREBASE_ERROR_MESSAGES = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const credential = await signIn(email, password);
      const admin = await getAdminByFirebaseUid(credential.user.uid);
      if (!admin) {
        setError("This account is not an admin.");
        return;
      }
      setSessionAdminId(admin.id);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(FIREBASE_ERROR_MESSAGES[err.code] || err.message || "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-sidebar items-center justify-center text-white text-2xl font-bold mb-3">M</div>
          <h1 className="text-2xl font-bold text-ink">Admin Login</h1>
          <p className="text-ink-2 text-sm mt-1">Manage doctor and registration desk accounts</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="form-input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-rejected-text">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
