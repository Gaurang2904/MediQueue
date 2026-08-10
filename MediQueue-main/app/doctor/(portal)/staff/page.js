"use client";

import { useEffect, useState } from "react";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import {
  getStaffForDoctor,
  createRegistrationStaffRow,
  setRegistrationStaffActive,
  deleteRegistrationStaffRow,
} from "@/lib/db";
import {
  createStaffFirebaseAccount,
  resetStaffPassword,
  setStaffFirebaseActive,
  deleteStaffFirebaseAccount,
} from "@/lib/staffAdmin";

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
    try {
      const { uid } = await createStaffFirebaseAccount({ name, email, password });
      const staff = await createRegistrationStaffRow({ doctorId, firebaseUid: uid, name, email });
      setName("");
      setEmail("");
      setPassword("");
      onCreated(staff);
    } catch (err) {
      setError(err.message || "Failed to create staff account. Please try again.");
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

function StaffRow({ staff, onChanged }) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetStaffPassword({ firebaseUid: staff.firebaseUid, newPassword });
      setNewPassword("");
      setResetting(false);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive() {
    setError("");
    setLoading(true);
    try {
      const nextActive = !staff.active;
      await setStaffFirebaseActive({ firebaseUid: staff.firebaseUid, active: nextActive });
      const updated = await setRegistrationStaffActive(staff.id, nextActive);
      onChanged(updated);
    } catch (err) {
      setError(err.message || "Failed to update account status.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${staff.name}'s registration desk account? This cannot be undone.`)) return;
    setError("");
    setLoading(true);
    try {
      await deleteStaffFirebaseAccount({ firebaseUid: staff.firebaseUid });
      await deleteRegistrationStaffRow(staff.id);
      onChanged(null, staff.id);
    } catch (err) {
      setError(err.message || "Failed to delete account.");
      setLoading(false);
    }
  }

  return (
    <tr className="border-t border-border align-top">
      <td className="py-2.5 px-3">{staff.name}</td>
      <td className="py-2.5 px-3">{staff.email}</td>
      <td className="py-2.5 px-3">
        <span className={staff.active ? "badge-completed" : "badge-rejected"}>
          {staff.active ? "Active" : "Deactivated"}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" disabled={loading} onClick={() => setResetting((v) => !v)}>
            Reset Password
          </button>
          <button type="button" className="btn-outline" disabled={loading} onClick={handleToggleActive}>
            {staff.active ? "Deactivate" : "Activate"}
          </button>
          <button type="button" className="text-sm text-rejected-text" disabled={loading} onClick={handleDelete}>
            Delete
          </button>
        </div>
        {resetting && (
          <form onSubmit={handleResetPassword} className="flex items-center gap-2 mt-2">
            <input
              type="text"
              minLength={6}
              required
              className="form-input"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </form>
        )}
        {error && <p className="text-xs text-rejected-text mt-1">{error}</p>}
      </td>
    </tr>
  );
}

export default function StaffManagementPage() {
  const doctor = useCurrentDoctor();
  const [staffList, setStaffList] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await getStaffForDoctor(doctor.id);
      setStaffList(data);
    } catch (err) {
      setError(err.message || "Failed to load staff accounts. Please refresh the page.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreated(staff) {
    setStaffList((prev) => [...(prev || []), staff]);
  }

  function handleChanged(updated, deletedId) {
    setStaffList((prev) => {
      if (deletedId) return prev.filter((s) => s.id !== deletedId);
      return prev.map((s) => (s.id === updated.id ? updated : s));
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Staff Management</h1>
        <p className="text-ink-2 text-sm mt-1">
          Create and manage Registration Desk accounts for your clinic. This is optional — you can
          continue to verify payments and update patient status yourself if you don&apos;t create any.
        </p>
      </div>

      <CreateStaffForm doctorId={doctor.id} onCreated={handleCreated} />

      <section className="card p-5">
        <h2 className="font-semibold text-ink mb-4">Registration Desk Accounts</h2>
        {error && <p className="text-sm text-rejected-text">{error}</p>}
        {!error && !staffList && <p className="text-sm text-ink-3">Loading...</p>}
        {staffList && staffList.length === 0 && (
          <p className="text-sm text-ink-3">No registration desk accounts yet.</p>
        )}
        {staffList && staffList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff) => (
                  <StaffRow key={staff.id} staff={staff} onChanged={handleChanged} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
