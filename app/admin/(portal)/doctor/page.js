"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getDoctor, getStaffForDoctor, createRegistrationStaffRow } from "@/lib/db";
import { createStaffFirebaseAccount } from "@/lib/staffAdmin";
import LoadingState from "@/components/LoadingState";

function CreateStaffForm({ doctorId, onCreated }) {
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
      ({ uid } = await createStaffFirebaseAccount({ name, email, password }));
    } catch (err) {
      setError(err.message || "Failed to create the login. Please try again.");
      setLoading(false);
      return;
    }
    try {
      const staff = await createRegistrationStaffRow({ doctorId, firebaseUid: uid, name, email });
      setName("");
      setEmail("");
      setPassword("");
      onCreated(staff);
    } catch (err) {
      setError(
        `${err.message || "Failed to create the staff profile."} The login for ${email} was created in Firebase but has no staff profile — delete that user in the Firebase console before trying again.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-3">
      <h2 className="font-semibold text-ink">Create Registration Desk Account</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="form-label" htmlFor="staffName">Name</label>
          <input id="staffName" className="form-input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="staffEmail">Email</label>
          <input id="staffEmail" type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="staffPassword">Temporary Password</label>
          <input id="staffPassword" type="text" minLength={6} className="form-input" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>
      </div>
      {error && <p className="text-sm text-rejected-text">{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Creating..." : "Create Account"}
      </button>
    </form>
  );
}

function AdminDoctorContent() {
  const searchParams = useSearchParams();
  const doctorId = searchParams.get("doctorId");
  const [doctor, setDoctor] = useState(null);
  const [staffList, setStaffList] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!doctorId) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await getDoctor(doctorId);
        if (cancelled) return;
        if (!d) {
          setNotFound(true);
          return;
        }
        setDoctor(d);
        setStaffList(await getStaffForDoctor(doctorId));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load this doctor. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  if (!doctorId) return <p className="text-sm text-ink-3">Missing doctor reference.</p>;
  if (error) return <p className="text-sm text-rejected-text">{error}</p>;
  if (notFound) return <p className="text-sm text-ink-3">Doctor not found.</p>;
  if (!doctor) return <LoadingState label="Loading doctor..." />;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin/dashboard" className="text-xs font-semibold text-primary">← All doctors</Link>
        <h1 className="text-2xl font-bold text-ink mt-2">{doctor.name}</h1>
        <p className="text-ink-2 text-sm mt-1">{doctor.email}</p>
      </div>

      <CreateStaffForm
        doctorId={doctor.id}
        onCreated={(staff) => setStaffList((prev) => [...(prev || []), staff])}
      />

      <section className="card p-5">
        <h2 className="font-semibold text-ink mb-4">Registration Desk Accounts</h2>
        {!staffList && <p className="text-sm text-ink-3">Loading...</p>}
        {staffList && staffList.length === 0 && (
          <p className="text-sm text-ink-3">No registration desk accounts under this doctor yet.</p>
        )}
        {staffList && staffList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff) => (
                  <tr key={staff.id} className="border-t border-border">
                    <td className="py-2.5 px-3">{staff.name}</td>
                    <td className="py-2.5 px-3">{staff.email}</td>
                    <td className="py-2.5 px-3">
                      <span className={staff.active ? "badge-completed" : "badge-rejected"}>
                        {staff.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-ink-3 mt-4">
          Resetting a password, deactivating or deleting a desk account stays with the doctor who owns
          it, from Doctor Dashboard → Staff.
        </p>
      </section>
    </div>
  );
}

export default function AdminDoctorPage() {
  return (
    <Suspense fallback={null}>
      <AdminDoctorContent />
    </Suspense>
  );
}
