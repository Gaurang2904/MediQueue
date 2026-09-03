"use client";

import { useState } from "react";
import { createPatientByStaff } from "@/lib/db";

function emptyForm(initialContact) {
  return {
    name: "",
    address: "",
    contact: initialContact || "",
    age: "",
    gender: "",
    bloodGroup: "",
    mobility: "",
    pastDiseaseHistory: "",
    pastDiseaseDetails: "",
    allergies: "",
    allergyDetails: "",
    dietaryRestrictions: "",
    weight: "",
    height: "",
  };
}

// Shared by the doctor portal (app/doctor/(portal)/patients/page.js) and the
// registration desk portal (app/registration/(portal)/dashboard/page.js), via
// components/PatientSearchAndRegister.js. Reuses createPatientByStaff (lib/db.js ->
// create_patient_by_staff RPC, see supabase.sql) instead of duplicating
// patient-creation logic -- the same RPC backs both portals, each RLS-authorized to
// call it independently (is_doctor() / active registration desk staff), so a staff
// account for one clinic can't register on behalf of another. `initialContact`
// prefills the contact field from the search step that precedes this in the wizard.
export default function PatientRegistrationForm({ onRegistered, initialContact = "" }) {
  const [form, setForm] = useState(() => emptyForm(initialContact));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    if (!/^\d{10}$/.test(form.contact)) {
      setError("Enter a valid 10-digit contact number.");
      return;
    }
    setLoading(true);
    try {
      const patient = await createPatientByStaff({
        ...form,
        pastDiseaseHistory: form.pastDiseaseHistory === "yes",
        allergies: form.allergies === "yes",
        dietaryRestrictions: form.dietaryRestrictions === "yes",
      });
      setForm(emptyForm(""));
      setSuccess(patient);
      onRegistered?.(patient);
    } catch (err) {
      setError(err.message || "Failed to register patient. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="form-label" htmlFor="reg-name">Full Name</label>
          <input id="reg-name" className="form-input" required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>

        <div className="col-span-2">
          <label className="form-label" htmlFor="reg-address">Address</label>
          <textarea id="reg-address" rows={2} className="form-textarea" required value={form.address} onChange={(e) => update("address", e.target.value)} />
        </div>

        <div>
          <label className="form-label" htmlFor="reg-contact">Contact Number</label>
          <input
            id="reg-contact"
            className="form-input"
            maxLength={10}
            required
            value={form.contact}
            onChange={(e) => update("contact", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="reg-age">Age</label>
          <input id="reg-age" type="number" min="0" className="form-input" required value={form.age} onChange={(e) => update("age", e.target.value)} />
        </div>

        <div>
          <label className="form-label" htmlFor="reg-gender">Gender</label>
          <select id="reg-gender" className="form-select" required value={form.gender} onChange={(e) => update("gender", e.target.value)}>
            <option value="" disabled>Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="reg-bloodGroup">Blood Group</label>
          <select id="reg-bloodGroup" className="form-select" required value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)}>
            <option value="" disabled>Select blood group</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="form-section-title mb-3">Medical Information</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label" htmlFor="reg-mobility">Mobility Level</label>
            <select id="reg-mobility" className="form-select" required value={form.mobility} onChange={(e) => update("mobility", e.target.value)}>
              <option value="" disabled>Select mobility</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="reg-pastDiseaseHistory">Past Disease History</label>
            <select id="reg-pastDiseaseHistory" className="form-select" required value={form.pastDiseaseHistory} onChange={(e) => update("pastDiseaseHistory", e.target.value)}>
              <option value="" disabled>Any past history?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {form.pastDiseaseHistory === "yes" && (
            <div className="col-span-2">
              <label className="form-label" htmlFor="reg-pastDiseaseDetails">Past Disease Details</label>
              <input id="reg-pastDiseaseDetails" className="form-input" placeholder="e.g. Hypertension, Diabetes Type 2" value={form.pastDiseaseDetails} onChange={(e) => update("pastDiseaseDetails", e.target.value)} />
            </div>
          )}

          <div>
            <label className="form-label" htmlFor="reg-allergies">Allergies</label>
            <select id="reg-allergies" className="form-select" required value={form.allergies} onChange={(e) => update("allergies", e.target.value)}>
              <option value="" disabled>Any allergies?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {form.allergies === "yes" && (
            <div>
              <label className="form-label" htmlFor="reg-allergyDetails">Allergy Details</label>
              <input id="reg-allergyDetails" className="form-input" placeholder="e.g. Penicillin, Dust" value={form.allergyDetails} onChange={(e) => update("allergyDetails", e.target.value)} />
            </div>
          )}

          <div>
            <label className="form-label" htmlFor="reg-dietaryRestrictions">Dietary Restrictions</label>
            <select id="reg-dietaryRestrictions" className="form-select" required value={form.dietaryRestrictions} onChange={(e) => update("dietaryRestrictions", e.target.value)}>
              <option value="" disabled>Any dietary restrictions?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="form-section-title mb-3">Vitals (Optional)</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label" htmlFor="reg-weight">Weight (kg) (Optional)</label>
            <input id="reg-weight" type="number" step="0.1" min="1" className="form-input" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="reg-height">Height (cm) (Optional)</label>
            <input id="reg-height" type="number" step="0.1" min="30" className="form-input" value={form.height} onChange={(e) => update("height", e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rejected-text">{error}</p>}
      {success && (
        <p className="text-sm text-completed-text">
          {success.name} was registered successfully. They don&apos;t have portal login
          credentials — this is a front-desk record, the same as a walk-in.
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Registering..." : "Register Patient"}
      </button>
    </form>
  );
}
