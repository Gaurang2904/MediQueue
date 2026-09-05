"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDoctors, createDoctorRow } from "@/lib/db";
import { createDoctorFirebaseAccount } from "@/lib/adminAccounts";

function CreateDoctorForm({ onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    let uid;
    try {
      ({ uid } = await createDoctorFirebaseAccount({ name, email, password }));
    } catch (err) {
      setError(err.message || "Failed to create the login. Please try again.");
      setLoading(false);
      return;
    }
    try {
      const doctor = await createDoctorRow({ firebaseUid: uid, name, email });
      setName("");
      setEmail("");
      setPassword("");
      onCreated(doctor);
    } catch (err) {
      // The Firebase login exists but the doctors row didn't get written, so the
      // account can sign in and immediately be bounced by the doctor portal. Say so
      // plainly rather than a bare "failed" -- retrying with the same email will now
      // hit "already exists", which would be baffling without this.
      setError(
        `${err.message || "Failed to create the doctor profile."} The login for ${email} was created in Firebase but has no doctor profile — delete that user in the Firebase console before trying again.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-3">
      <h2 className="font-semibold text-ink">Create Doctor Account</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="form-label" htmlFor="doctorName">Name</label>
          <input id="doctorName" className="form-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Full Name" />
        </div>
        <div>
          <label className="form-label" htmlFor="doctorEmail">Email</label>
          <input id="doctorEmail" type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="doctorPassword">Temporary Password</label>
          <input id="doctorPassword" type="text" minLength={6} className="form-input" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>
      </div>
      <p className="text-xs text-ink-3">
        The doctor sets their own fee, clinic details, timings and payment QR from Doctor Dashboard → Profile after signing in.
      </p>
      {error && <p className="text-sm text-rejected-text">{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Creating..." : "Create Account"}
      </button>
    </form>
  );
}

export default function AdminDashboardPage() {
  const [doctors, setDoctors] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setDoctors(await getDoctors());
      } catch (err) {
        setError(err.message || "Failed to load doctors. Please refresh the page.");
      }
    })();
  }, []);

  function handleCreated(doctor) {
    setDoctors((prev) => [...(prev || []), doctor].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Doctors</h1>
        <p className="text-ink-2 text-sm mt-1">
          Create doctor logins, and registration desk accounts under each of them.
        </p>
      </div>

      <CreateDoctorForm onCreated={handleCreated} />

      <section className="card p-5">
        <h2 className="font-semibold text-ink mb-4">All Doctors</h2>
        {error && <p className="text-sm text-rejected-text">{error}</p>}
        {!error && !doctors && <p className="text-sm text-ink-3">Loading...</p>}
        {doctors && doctors.length === 0 && <p className="text-sm text-ink-3">No doctors yet.</p>}
        {doctors && doctors.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Login</th>
                  <th className="py-2 px-3 font-medium">Staff</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor.id} className="border-t border-border">
                    <td className="py-2.5 px-3">{doctor.name}</td>
                    <td className="py-2.5 px-3">{doctor.email}</td>
                    <td className="py-2.5 px-3">
                      {/* A row with no firebase_uid can't be signed into -- the seeded
                          doctor starts this way, and so does any row linked by hand. */}
                      <span className={doctor.firebaseUid ? "badge-completed" : "badge-rejected"}>
                        {doctor.firebaseUid ? "Linked" : "No login"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Link href={`/admin/doctor?doctorId=${doctor.id}`} className="text-sm font-semibold text-primary">
                        Manage staff
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
