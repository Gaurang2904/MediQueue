"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPatients } from "@/lib/db";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import PatientSearchAndRegister from "@/components/PatientSearchAndRegister";

export default function DoctorPatientsPage() {
  const doctor = useCurrentDoctor();
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getPatients();
        if (!cancelled) setPatients(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load patients.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePatients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((patient) => patient.name.toLowerCase().includes(term) || patient.contact.includes(term));
  }, [patients, query]);

  // Inserts the newly registered patient straight into local state, sorted the same
  // way as the initial getPatients() load (.order("name") in lib/db.js) -- the new
  // patient shows up in the table immediately, no refetch/reload needed. A patient
  // found via search (not newly created) is already in this list, so nothing to do.
  function handlePatientRegistered(patient) {
    setPatients((prev) => [...prev, patient].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Patients</h1>
          <p className="text-sm text-ink-2">Open a patient record to review history and start or continue a consultation.</p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={() => setShowRegisterForm((v) => !v)}>
          {showRegisterForm ? "Close" : "+ Register Patient"}
        </button>
      </div>

      {error && <p className="text-sm text-rejected-text">{error}</p>}

      {showRegisterForm && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-4">Register Patient</h2>
          <PatientSearchAndRegister
            doctorId={doctor.id}
            onPatientRegistered={handlePatientRegistered}
            getPatientRecordHref={(patientId) => `/doctor/patient?patientId=${patientId}`}
          />
        </div>
      )}

      <div className="card p-5">
        <label className="form-label" htmlFor="patient-search">Search patient</label>
        <input id="patient-search" className="form-input max-w-md" placeholder="Name or contact number" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-ink-2">
              <tr><th className="px-5 py-3 font-medium">Patient</th><th className="px-5 py-3 font-medium">Contact</th><th className="px-5 py-3 font-medium">Details</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody>
              {visiblePatients.map((patient) => (
                <tr key={patient.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium text-ink">{patient.name}</td>
                  <td className="px-5 py-3 text-ink-2">{patient.contact}</td>
                  <td className="px-5 py-3 text-ink-2">{patient.age} yrs · {patient.gender}</td>
                  <td className="px-5 py-3 text-right"><Link href={`/doctor/patient?patientId=${patient.id}`} className="text-primary font-semibold">View record</Link></td>
                </tr>
              ))}
              {visiblePatients.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-8 text-center text-ink-3">
                    {loading ? "Loading patients..." : error ? "Couldn't load patients." : "No patients found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
