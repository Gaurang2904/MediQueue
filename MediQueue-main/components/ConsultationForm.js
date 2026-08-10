"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeConsultation, updatePatientVitals } from "@/lib/db";

function MedicineEditor({ title, items, setItems }) {
  function update(i, field, value) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function add() {
    setItems([...items, { name: "", dosage: "", duration: "" }]);
  }
  function remove(i) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="form-label mb-0">{title}</span>
        <button type="button" onClick={add} className="text-xs font-semibold text-primary">+ Add medicine</button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-7 gap-2 items-center">
            <input aria-label={`${title} #${i + 1} name`} className="form-input col-span-3" placeholder="Medicine name" value={item.name} onChange={(e) => update(i, "name", e.target.value)} />
            <input aria-label={`${title} #${i + 1} dosage`} className="form-input col-span-2" placeholder="Dosage" value={item.dosage} onChange={(e) => update(i, "dosage", e.target.value)} />
            <input aria-label={`${title} #${i + 1} duration`} className="form-input col-span-1" placeholder="Duration" value={item.duration} onChange={(e) => update(i, "duration", e.target.value)} />
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${title} #${i + 1}`} className="text-xs text-rejected-text col-span-1">Remove</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-ink-3">No medicines added.</p>}
      </div>
    </div>
  );
}

export default function ConsultationForm({ visit, patient, consultation }) {
  const router = useRouter();
  const [height, setHeight] = useState(patient?.vitals?.height ?? "");
  const [weight, setWeight] = useState(patient?.vitals?.weight ?? "");
  const [bpSystolic, setBpSystolic] = useState(patient?.vitals?.bpSystolic ?? "");
  const [bpDiastolic, setBpDiastolic] = useState(patient?.vitals?.bpDiastolic ?? "");
  const [symptoms, setSymptoms] = useState(consultation?.symptoms || "");
  const [findings, setFindings] = useState(consultation?.findings || "");
  const [diagnosisNotes, setDiagnosisNotes] = useState(consultation?.diagnosisNotes || "");
  const [clinicMedicines, setClinicMedicines] = useState(consultation?.clinicMedicines || []);
  const [outsideMedicines, setOutsideMedicines] = useState(consultation?.outsideMedicines || []);
  const [followUp, setFollowUp] = useState(consultation?.followUp || "");
  const [lifestyleAdvice, setLifestyleAdvice] = useState(consultation?.lifestyleAdvice || "");
  const [precautions, setPrecautions] = useState(consultation?.precautions || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleComplete(e) {
    e.preventDefault();
    setError("");
    if (!diagnosisNotes.trim()) {
      setError("Diagnosis notes are required before completing the consultation.");
      return;
    }
    setLoading(true);
    try {
      // Drop medicine rows left blank (e.g. "+ Add medicine" clicked but never filled
      // in) instead of persisting empty entries.
      const withoutBlankRows = (items) => items.filter((item) => item.name.trim() !== "");
      await completeConsultation(visit.id, {
        symptoms,
        findings,
        diagnosisNotes,
        clinicMedicines: withoutBlankRows(clinicMedicines),
        outsideMedicines: withoutBlankRows(outsideMedicines),
        followUp,
        lifestyleAdvice,
        precautions,
      });
      if (height !== "" || weight !== "" || bpSystolic !== "" || bpDiastolic !== "") {
        await updatePatientVitals(visit.patientId, { height, weight, bpSystolic, bpDiastolic });
      }
      router.push(`/doctor/patient?patientId=${visit.patientId}`);
    } catch (err) {
      setError(err.message || "Failed to save consultation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleComplete} className="space-y-6">
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-ink">Vitals (Optional)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label" htmlFor="height">Height (cm)</label>
            <input id="height" type="number" min="1" max="250" className="form-input" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="weight">Weight (kg)</label>
            <input id="weight" type="number" min="1" max="500" className="form-input" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="bpSystolic">Blood Pressure — Systolic (mmHg)</label>
            <input id="bpSystolic" type="number" min="40" max="250" className="form-input" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="bpDiastolic">Blood Pressure — Diastolic (mmHg)</label>
            <input id="bpDiastolic" type="number" min="30" max="160" className="form-input" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-ink">A. Diagnosis</h2>
        <div>
          <label className="form-label">Symptoms</label>
          <textarea className="form-textarea" rows={2} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Findings</label>
          <textarea className="form-textarea" rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Diagnosis Notes (required)</label>
          <textarea className="form-textarea" rows={2} value={diagnosisNotes} onChange={(e) => setDiagnosisNotes(e.target.value)} />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-ink mb-3">B. Medicines from Clinic</h2>
        <MedicineEditor title="Clinic Medicines" items={clinicMedicines} setItems={setClinicMedicines} />
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-ink mb-3">C. Outside Medicines</h2>
        <MedicineEditor title="Outside Medicines" items={outsideMedicines} setItems={setOutsideMedicines} />
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-ink">D. Additional Notes</h2>
        <div>
          <label className="form-label">Follow-up Instructions</label>
          <textarea className="form-textarea" rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Lifestyle Advice</label>
          <textarea className="form-textarea" rows={2} value={lifestyleAdvice} onChange={(e) => setLifestyleAdvice(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Precautions</label>
          <textarea className="form-textarea" rows={2} value={precautions} onChange={(e) => setPrecautions(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-rejected-text">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Completing..." : "Complete Consultation"}
      </button>
    </form>
  );
}
