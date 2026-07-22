// Browser-local session, replacing server cookies so the app can run with
// no server at all. Only call these from client components (event handlers
// or useEffect) — they read/write window.localStorage.

const PATIENT_KEY = "mediqueue-pid";
const DOCTOR_KEY = "mediqueue-did";

export function getSessionPatientId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PATIENT_KEY);
}

export function setSessionPatientId(id) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DOCTOR_KEY);
  window.localStorage.setItem(PATIENT_KEY, id);
}

export function getSessionDoctorId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DOCTOR_KEY);
}

export function setSessionDoctorId(id) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PATIENT_KEY);
  window.localStorage.setItem(DOCTOR_KEY, id);
}

export function clearPatientSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PATIENT_KEY);
}

export function clearDoctorSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DOCTOR_KEY);
}
