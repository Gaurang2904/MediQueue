"use client";

import { useState } from "react";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { updateDoctorProfile } from "@/lib/db";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DoctorProfilePage() {
  const doctor = useCurrentDoctor();
  const [name, setName] = useState(doctor.name || "");
  const [clinicName, setClinicName] = useState(doctor.clinicName || "");
  const [qualification, setQualification] = useState(doctor.qualification || "");
  const [specialization, setSpecialization] = useState(doctor.specialization || "");
  const [startTime, setStartTime] = useState(doctor.slotConfig?.startTime || "09:00");
  const [endTime, setEndTime] = useState(doctor.slotConfig?.endTime || "13:00");
  const [durationMinutes, setDurationMinutes] = useState(doctor.slotConfig?.durationMinutes ?? 20);
  const [capacityPerSlot, setCapacityPerSlot] = useState(doctor.slotConfig?.capacityPerSlot ?? 1);
  const [availableDays, setAvailableDays] = useState(doctor.availableDays || []);
  const [clinicAddress, setClinicAddress] = useState(doctor.clinicAddress || "");
  const [phone, setPhone] = useState(doctor.phone || "");
  const [gstin, setGstin] = useState(doctor.gstin || "");
  const [consultationFee, setConsultationFee] = useState(doctor.consultationFee ?? 500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function toggleDay(day) {
    setAvailableDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!Number.isFinite(Number(consultationFee)) || Number(consultationFee) < 0) {
      setError("Enter a valid consultation fee.");
      return;
    }
    setLoading(true);
    try {
      await updateDoctorProfile(doctor.id, {
        name,
        clinicName,
        qualification,
        specialization,
        availableDays,
        clinicAddress,
        phone,
        gstin,
        consultationFee: Number(consultationFee),
        slotConfig: {
          startTime,
          endTime,
          durationMinutes: Number(durationMinutes),
          capacityPerSlot: Number(capacityPerSlot),
        },
      });
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-ink">Basic Info</h2>
          <div>
            <label className="form-label" htmlFor="name">Name</label>
            <input id="name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="form-label" htmlFor="clinicName">Clinic Name</label>
            <input id="clinicName" className="form-input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="qualification">Qualification</label>
              <input id="qualification" className="form-input" value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="e.g. MBBS, MD" />
            </div>
            <div>
              <label className="form-label" htmlFor="specialization">Specialization</label>
              <input id="specialization" className="form-input" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="e.g. General Physician" />
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="phone">Phone Number</label>
            <input id="phone" type="tel" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="gstin">GSTIN Number</label>
            <input id="gstin" className="form-input" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="form-label" htmlFor="clinicAddress">Clinic Address</label>
            <textarea id="clinicAddress" className="form-textarea" rows={2} value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} />
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-ink">Consultation Timing</h2>
          <div>
            <label className="form-label" htmlFor="consultationFee">Consultation Fee (₹)</label>
            <input id="consultationFee" type="number" min="0" step="1" className="form-input" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="startTime">Start Time</label>
              <input id="startTime" type="time" className="form-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div>
              <label className="form-label" htmlFor="endTime">End Time</label>
              <input id="endTime" type="time" className="form-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
            <div>
              <label className="form-label" htmlFor="durationMinutes">Slot Duration (minutes)</label>
              <input id="durationMinutes" type="number" min="5" max="120" className="form-input" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} required />
            </div>
            <div>
              <label className="form-label" htmlFor="capacityPerSlot">Patients per Slot</label>
              <input id="capacityPerSlot" type="number" min="1" max="20" className="form-input" value={capacityPerSlot} onChange={(e) => setCapacityPerSlot(e.target.value)} required />
            </div>
          </div>
          <div>
            <span className="form-label">Available Days</span>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((day) => (
                <label key={day} className="flex items-center gap-1.5 text-sm text-ink">
                  <input type="checkbox" checked={availableDays.includes(day)} onChange={() => toggleDay(day)} />
                  {day}
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-rejected-text">{error}</p>}
        {success && <p className="text-sm text-completed-text">{success}</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
