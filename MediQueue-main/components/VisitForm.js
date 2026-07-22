"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSlotsForDate, createVisit } from "@/lib/db";

const ILLNESS_OPTIONS = ["Fever", "Cold & Cough", "Headache", "Body Pain", "Stomach Ache", "Other"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function VisitForm({ patient, doctor }) {
  const router = useRouter();
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [illness, setIllness] = useState(ILLNESS_OPTIONS[0]);
  const [customIllness, setCustomIllness] = useState("");
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isWalkIn) setDate(todayStr());
  }, [isWalkIn]);

  useEffect(() => {
    if (!date) return;
    setSlots(getSlotsForDate(doctor.id, date));
    setSlot("");
  }, [date, doctor.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!slot) {
      setError("Please select a slot.");
      return;
    }
    setLoading(true);
    try {
      createVisit({
        patientId: patient.id,
        doctorId: doctor.id,
        date,
        illness: illness === "Other" ? customIllness || "Other" : illness,
        slot,
        isWalkIn,
        paymentMode,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Could not book this visit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-ink-2">
        <input type="checkbox" checked={isWalkIn} onChange={(e) => setIsWalkIn(e.target.checked)} />
        Walk-in visit (today)
      </label>

      <div>
        <label className="form-label" htmlFor="date">Visit Date</label>
        <input
          id="date"
          type="date"
          className="form-input"
          value={date}
          min={todayStr()}
          disabled={isWalkIn}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <label className="form-label" htmlFor="illness">Illness Description</label>
        <select id="illness" className="form-select" value={illness} onChange={(e) => setIllness(e.target.value)}>
          {ILLNESS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {illness === "Other" && (
          <input
            className="form-input mt-2"
            placeholder="Describe your illness"
            value={customIllness}
            onChange={(e) => setCustomIllness(e.target.value)}
          />
        )}
      </div>

      <div>
        <span className="form-label">Appointment Slot</span>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((s) => (
            <button
              type="button"
              key={s.slot}
              disabled={s.isFull}
              onClick={() => setSlot(s.slot)}
              className={`text-xs rounded-md border px-2 py-2 font-medium transition-colors ${
                s.isFull
                  ? "bg-surface-2 text-ink-3 border-border cursor-not-allowed line-through"
                  : slot === s.slot
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-ink border-border hover:border-primary"
              }`}
            >
              {s.slot}
            </button>
          ))}
          {slots.length === 0 && <p className="text-xs text-ink-3 col-span-3">No slots configured for this date.</p>}
        </div>
      </div>

      <div>
        <span className="form-label">Payment Mode</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="paymentMode" checked={paymentMode === "cash"} onChange={() => setPaymentMode("cash")} />
            Cash
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="paymentMode" checked={paymentMode === "online"} onChange={() => setPaymentMode("online")} />
            Online
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-rejected-text">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Booking..." : "Book Appointment"}
      </button>
    </form>
  );
}
