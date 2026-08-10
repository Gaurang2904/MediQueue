"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPatient } from "@/lib/db";
import { setSessionPatientId } from "@/lib/auth";
import { signUp, deleteAccount } from "@/lib/firebaseAuth";
import { auth } from "@/lib/firebase"; // TEMP DIAGNOSTIC import — remove after RLS investigation
import Link from "next/link";

const FIREBASE_ERROR_MESSAGES = {
  "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Password must be at least 6 characters.",
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    address: "",
    contact: searchParams.get("contact") || "",
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
  });
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{10}$/.test(form.contact)) {
      setError("Enter a valid 10-digit contact number.");
      return;
    }
    setLoading(true);
    let credential;
    try {
      credential = await signUp(form.email, form.password);
      // TEMP DIAGNOSTIC — remove after RLS investigation.
      console.log(
        "[diag:register] credential.user.uid=%s auth.currentUser?.uid=%s (these should match)",
        credential.user.uid,
        auth.currentUser?.uid
      );
      const patient = await createPatient({
        ...form,
        firebaseUid: credential.user.uid,
        photoDataUrl,
        pastDiseaseHistory: form.pastDiseaseHistory === "yes",
        allergies: form.allergies === "yes",
        dietaryRestrictions: form.dietaryRestrictions === "yes",
      });
      setSessionPatientId(patient.id);
      router.push("/visit/new");
    } catch (err) {
      if (credential) {
        // signUp succeeded but createPatient failed — roll back the Firebase account
        // instead of leaving an orphaned auth user with no patient row, which would
        // otherwise permanently block re-registering with this email ("email already
        // in use") with no way to recover.
        try {
          await deleteAccount(credential.user);
        } catch (rollbackErr) {
          console.error("Failed to roll back Firebase account after registration failure:", rollbackErr);
        }
      }
      setError(FIREBASE_ERROR_MESSAGES[err.code] || err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-ink">Patient Registration</h1>
          <p className="text-ink-2 text-sm mt-1">First visit? Let&apos;s create your patient profile.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="form-section-title">Account</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="form-input" required value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div>
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type="password" minLength={6} className="form-input" required value={form.password} onChange={(e) => update("password", e.target.value)} />
            </div>
          </div>

          <div className="form-section-title">Personal Information</div>

          <div>
            <label className="form-label" htmlFor="photo">Patient Photograph</label>
            <input id="photo" type="file" accept="image/*" capture="environment" className="form-input" onChange={handlePhoto} />
            {photoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoDataUrl} alt="Preview" className="mt-2 w-20 h-20 rounded-lg object-cover border border-border" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label" htmlFor="name">Full Name</label>
              <input id="name" className="form-input" required value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className="form-label" htmlFor="address">Address</label>
              <textarea id="address" rows={2} className="form-textarea" required value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>

            <div>
              <label className="form-label" htmlFor="contact">Contact Number</label>
              <input
                id="contact"
                className="form-input"
                maxLength={10}
                required
                value={form.contact}
                onChange={(e) => update("contact", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="age">Age</label>
              <input id="age" type="number" min="0" className="form-input" required value={form.age} onChange={(e) => update("age", e.target.value)} />
            </div>

            <div>
              <label className="form-label" htmlFor="gender">Gender</label>
              <select id="gender" className="form-select" required value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                <option value="" disabled>Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="bloodGroup">Blood Group</label>
              <select id="bloodGroup" className="form-select" required value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)}>
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
                <label className="form-label" htmlFor="mobility">Mobility Level</label>
                <select id="mobility" className="form-select" required value={form.mobility} onChange={(e) => update("mobility", e.target.value)}>
                  <option value="" disabled>Select mobility</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="pastDiseaseHistory">Past Disease History</label>
                <select id="pastDiseaseHistory" className="form-select" required value={form.pastDiseaseHistory} onChange={(e) => update("pastDiseaseHistory", e.target.value)}>
                  <option value="" disabled>Any past history?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {form.pastDiseaseHistory === "yes" && (
                <div className="col-span-2">
                  <label className="form-label" htmlFor="pastDiseaseDetails">Past Disease Details</label>
                  <input id="pastDiseaseDetails" className="form-input" placeholder="e.g. Hypertension, Diabetes Type 2" value={form.pastDiseaseDetails} onChange={(e) => update("pastDiseaseDetails", e.target.value)} />
                </div>
              )}

              <div>
                <label className="form-label" htmlFor="allergies">Allergies</label>
                <select id="allergies" className="form-select" required value={form.allergies} onChange={(e) => update("allergies", e.target.value)}>
                  <option value="" disabled>Any allergies?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {form.allergies === "yes" && (
                <div>
                  <label className="form-label" htmlFor="allergyDetails">Allergy Details</label>
                  <input id="allergyDetails" className="form-input" placeholder="e.g. Penicillin, Dust" value={form.allergyDetails} onChange={(e) => update("allergyDetails", e.target.value)} />
                </div>
              )}

              <div>
                <label className="form-label" htmlFor="dietaryRestrictions">Dietary Restrictions</label>
                <select id="dietaryRestrictions" className="form-select" required value={form.dietaryRestrictions} onChange={(e) => update("dietaryRestrictions", e.target.value)}>
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
                <label className="form-label" htmlFor="weight">Weight (kg) (Optional)</label>
                <input id="weight" type="number" step="0.1" min="1" className="form-input" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="height">Height (cm) (Optional)</label>
                <input id="height" type="number" step="0.1" min="30" className="form-input" value={form.height} onChange={(e) => update("height", e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-rejected-text">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Patient Account"}
          </button>
          <p className="text-center text-sm text-ink-3">Already registered? <Link href="/patient/login" className="text-primary font-semibold">Sign in to the patient portal</Link></p>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
