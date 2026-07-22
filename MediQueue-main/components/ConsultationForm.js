"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeConsultation } from "@/lib/db";

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
            <input className="form-input col-span-3" placeholder="Medicine name" value={item.name} onChange={(e) => update(i, "name", e.target.value)} />
            <input className="form-input col-span-2" placeholder="Dosage" value={item.dosage} onChange={(e) => update(i, "dosage", e.target.value)} />
            <input className="form-input col-span-1" placeholder="Duration" value={item.duration} onChange={(e) => update(i, "duration", e.target.value)} />
            <button type="button" onClick={() => remove(i)} className="text-xs text-rejected-text col-span-1">Remove</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-ink-3">No medicines added.</p>}
      </div>
    </div>
  );
}

export default function ConsultationForm({ visit, consultation }) {
  const router = useRouter();
  const [symptoms, setSymptoms] = useState(consultation?.symptoms || "");
  const [findings, setFindings] = useState(consultation?.findings || "");
  const [diagnosisNotes, setDiagnosisNotes] = useState(consultation?.diagnosisNotes || "");
  const [clinicMedicines, setClinicMedicines] = useState(consultation?.clinicMedicines || []);
  const [outsideMedicines, setOutsideMedicines] = useState(consultation?.outsideMedicines || []);
  const [followUp, setFollowUp] = useState(consultation?.followUp || "");
  const [lifestyleAdvice, setLifestyleAdvice] = useState(consultation?.lifestyleAdvice || "");
  const [precautions, setPrecautions] = useState(consultation?.precautions || "");
  const [loading, setLoading] = useState(false);

  async function handleComplete(e) {
    e.preventDefault();
    setLoading(true);
    try {
      completeConsultation(visit.id, {
        symptoms,
        findings,
        diagnosisNotes,
        clinicMedicines,
        outsideMedicines,
        followUp,
        lifestyleAdvice,
        precautions,
      });
      router.push(`/doctor/patient?patientId=${visit.patientId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleComplete} className="space-y-6">
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
          <label className="form-label">Diagnosis Notes</label>
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

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Completing..." : "Complete Consultation"}
      </button>
    </form>
  );
}
