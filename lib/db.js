// Supabase-backed data layer. Collection names/shapes mirror the Postgres tables
// defined in supabase.sql (patients, doctors, visits, consultations, payments).
// Every exported function returns the same camelCase object shape the app has
// always used — only the storage backend changed (localStorage -> Supabase).

import { supabase } from "./supabase";
import { toUserMessage } from "./errors";

function unwrap({ data, error }) {
  if (error) throw new Error(toUserMessage(error));
  return data;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Row <-> camelCase mappers ----------

function rowToDoctor(row) {
  if (!row) return null;
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    name: row.name,
    clinicName: row.clinic_name,
    email: row.email,
    qrCodeUrl: row.qr_code_url,
    consultationFee: row.consultation_fee,
    status: row.status,
    slotConfig: row.slot_config,
    qualification: row.qualification,
    specialization: row.specialization,
    availableDays: row.available_days || [],
    clinicAddress: row.clinic_address,
    phone: row.phone,
    gstin: row.gstin,
  };
}

function rowToRegistrationStaff(row) {
  if (!row) return null;
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    doctorId: row.doctor_id,
    name: row.name,
    email: row.email,
    active: row.active,
  };
}

function rowToPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    photoDataUrl: row.photo_data_url,
    name: row.name,
    address: row.address,
    contact: row.contact,
    age: row.age,
    gender: row.gender,
    bloodGroup: row.blood_group,
    mobility: row.mobility,
    pastDiseaseHistory: row.past_disease_history,
    pastDiseaseDetails: row.past_disease_details,
    allergies: row.allergies,
    allergyDetails: row.allergy_details,
    dietaryRestrictions: row.dietary_restrictions,
    vitals: row.vitals || {},
    registeredAt: row.registered_at,
  };
}

function rowToVisit(row) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    date: row.date,
    illness: row.illness,
    slot: row.slot,
    isWalkIn: row.is_walk_in,
    queueNumber: row.queue_number,
    paymentMode: row.payment_mode,
    status: row.status,
    createdAt: row.created_at,
  };
}

function rowToConsultation(row) {
  if (!row) return null;
  return {
    id: row.id,
    visitId: row.visit_id,
    symptoms: row.symptoms,
    findings: row.findings,
    diagnosisNotes: row.diagnosis_notes,
    clinicMedicines: row.clinic_medicines || [],
    outsideMedicines: row.outside_medicines || [],
    requiredTests: row.required_tests || [],
    additionalBilling: row.additional_billing || [],
    followUp: row.follow_up,
    lifestyleAdvice: row.lifestyle_advice,
    precautions: row.precautions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    visitId: row.visit_id,
    amount: row.amount,
    mode: row.mode,
    status: row.status,
    screenshotDataUrl: row.screenshot_data_url,
    billSnapshot: row.bill_snapshot,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

// ---------- Doctors ----------

export async function getDoctors() {
  const data = unwrap(await supabase.from("doctors").select("*"));
  return data.map(rowToDoctor);
}

export async function getDoctor(id) {
  const data = unwrap(await supabase.from("doctors").select("*").eq("id", id).maybeSingle());
  return rowToDoctor(data);
}

export async function getDoctorByFirebaseUid(uid) {
  const data = unwrap(await supabase.from("doctors").select("*").eq("firebase_uid", uid).maybeSingle());
  return rowToDoctor(data);
}

export async function setDoctorStatus(doctorId, status) {
  const data = unwrap(
    await supabase.from("doctors").update({ status }).eq("id", doctorId).select().maybeSingle()
  );
  return rowToDoctor(data);
}

// A doctor editing their own profile. Safe as a plain update: the doctors_update_own
// RLS policy already scopes this to the caller's own row (see supabase.sql), which is
// what actually prevents editing another doctor's profile.
export async function updateDoctorProfile(doctorId, {
  name,
  clinicName,
  qualification,
  specialization,
  availableDays,
  clinicAddress,
  phone,
  gstin,
  consultationFee,
  slotConfig,
}) {
  const row = {
    name,
    clinic_name: clinicName || null,
    qualification: qualification || null,
    specialization: specialization || null,
    available_days: availableDays || [],
    clinic_address: clinicAddress || null,
    phone: phone || null,
    gstin: gstin || null,
    consultation_fee: consultationFee,
    slot_config: slotConfig,
  };
  const data = unwrap(
    await supabase.from("doctors").update(row).eq("id", doctorId).select().maybeSingle()
  );
  return rowToDoctor(data);
}

function generateSlotsForDoctor(doctor) {
  const { startTime, endTime, durationMinutes } = doctor.slotConfig;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const slots = [];
  for (let t = start; t + durationMinutes <= end; t += durationMinutes) {
    const from = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    const toMin = t + durationMinutes;
    const to = `${String(Math.floor(toMin / 60)).padStart(2, "0")}:${String(toMin % 60).padStart(2, "0")}`;
    slots.push(`${from}-${to}`);
  }
  return slots;
}

export async function getSlotsForDate(doctorId, date) {
  const doctor = await getDoctor(doctorId);
  if (!doctor) return [];
  const allSlots = generateSlotsForDoctor(doctor);
  const dayVisits = unwrap(
    await supabase
      .from("visits")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("date", date)
      .neq("status", "cancelled")
  ).map(rowToVisit);
  return allSlots.map((slot) => {
    const booked = dayVisits.filter((v) => v.slot === slot).length;
    return {
      slot,
      capacity: doctor.slotConfig.capacityPerSlot,
      booked,
      isFull: booked >= doctor.slotConfig.capacityPerSlot,
    };
  });
}

// ---------- Patients ----------

export async function getPatientByFirebaseUid(uid) {
  const data = unwrap(await supabase.from("patients").select("*").eq("firebase_uid", uid).maybeSingle());
  return rowToPatient(data);
}

export async function getPatients() {
  const data = unwrap(await supabase.from("patients").select("*").order("name"));
  return data.map(rowToPatient);
}

export async function getPatientById(id) {
  const data = unwrap(await supabase.from("patients").select("*").eq("id", id).maybeSingle());
  return rowToPatient(data);
}

export async function createPatient({
  firebaseUid,
  email,
  photoDataUrl,
  name,
  address,
  contact,
  age,
  gender,
  bloodGroup,
  mobility,
  pastDiseaseHistory,
  pastDiseaseDetails,
  allergies,
  allergyDetails,
  dietaryRestrictions,
  weight,
  height,
}) {
  const row = {
    firebase_uid: firebaseUid || null,
    email: email || null,
    photo_data_url: photoDataUrl || null,
    name,
    address,
    contact,
    age: Number(age),
    gender,
    blood_group: bloodGroup || null,
    mobility: mobility || null,
    past_disease_history: !!pastDiseaseHistory,
    past_disease_details: pastDiseaseDetails || "",
    allergies: !!allergies,
    allergy_details: allergyDetails || "",
    dietary_restrictions: !!dietaryRestrictions,
    vitals: {
      weight: weight !== undefined && weight !== "" ? Number(weight) : null,
      height: height !== undefined && height !== "" ? Number(height) : null,
      bpSystolic: null,
      bpDiastolic: null,
    },
  };

  const { data, error } = await supabase.from("patients").insert(row).select().single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("A patient with this contact number is already registered.");
    }
    throw new Error(toUserMessage(error));
  }
  return rowToPatient(data);
}

// Doctor/registration-desk-only: registers a patient from the doctor or front-desk
// portal instead of the patient's own self-signup flow. Goes through the
// create_patient_by_staff Postgres function (see supabase.sql) instead of a direct
// table insert, since RLS's patients_insert_own policy only lets a patient insert
// their own row (firebase_uid = caller's uid) -- this is a narrow, doctor/staff-checked
// write path with the same field shape as createPatient() above. The created row has
// no firebase_uid (no portal login), same as any other front-desk/walk-in record.
export async function createPatientByStaff({
  email,
  photoDataUrl,
  name,
  address,
  contact,
  age,
  gender,
  bloodGroup,
  mobility,
  pastDiseaseHistory,
  pastDiseaseDetails,
  allergies,
  allergyDetails,
  dietaryRestrictions,
  weight,
  height,
}) {
  const { data, error } = await supabase.rpc("create_patient_by_staff", {
    p_email: email || null,
    p_photo_data_url: photoDataUrl || null,
    p_name: name,
    p_address: address,
    p_contact: contact,
    p_age: Number(age),
    p_gender: gender,
    p_blood_group: bloodGroup || null,
    p_mobility: mobility || null,
    p_past_disease_history: !!pastDiseaseHistory,
    p_past_disease_details: pastDiseaseDetails || "",
    p_allergies: !!allergies,
    p_allergy_details: allergyDetails || "",
    p_dietary_restrictions: !!dietaryRestrictions,
    p_weight: weight !== undefined && weight !== "" ? Number(weight) : null,
    p_height: height !== undefined && height !== "" ? Number(height) : null,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("A patient with this contact number is already registered.");
    }
    throw new Error(toUserMessage(error));
  }
  return rowToPatient(data);
}

// Doctor/registration-desk-only: search for an existing patient by contact number
// before registering a new one (prevents duplicate patient records for the same
// person). Goes through the find_patient_by_contact Postgres function (see
// supabase.sql) rather than a direct select -- for registration desk this is the
// *only* way to find a patient who doesn't have a visit under their doctor yet
// (patients_select_registration only grants that once a visit exists), and for both
// roles it returns identity fields only (no medical history/address/photo), never a
// full patient row, even though a doctor's direct read access is broader elsewhere.
export async function findPatientByContact(contact) {
  const data = unwrap(await supabase.rpc("find_patient_by_contact", { p_contact: contact }));
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    contact: row.contact,
    bloodGroup: row.blood_group,
    hasLogin: row.has_login,
  }));
}

// Doctor/registration-desk-only: links an existing walk-in patient record (no
// firebase_uid yet) to a Firebase account that was just created for this specific
// purpose (see lib/patientAdmin.js / netlify/functions/patient-create.js). Goes
// through link_patient_firebase_uid (see supabase.sql), which refuses to relink an
// already-linked patient -- this can never be used to take over an existing account.
export async function linkPatientFirebaseUid(patientId, firebaseUid) {
  const data = unwrap(
    await supabase.rpc("link_patient_firebase_uid", { p_patient_id: patientId, p_firebase_uid: firebaseUid })
  );
  return rowToPatient(data);
}

// Doctor-only: records vitals (height/weight/blood pressure) on a patient's record.
// Goes through the update_patient_vitals Postgres function (see supabase.sql) instead
// of a direct table update, since RLS only lets a patient write their own row — this is
// a narrow, doctor-checked write path that touches nothing but the vitals fields. Only
// the fields actually passed in are patched, so e.g. submitting weight/height alone
// doesn't blank out an existing BP reading.
export async function updatePatientVitals(patientId, { weight, height, bpSystolic, bpDiastolic }) {
  const w = weight !== undefined && weight !== "" ? Number(weight) : null;
  const h = height !== undefined && height !== "" ? Number(height) : null;
  const systolic = bpSystolic !== undefined && bpSystolic !== "" ? Number(bpSystolic) : null;
  const diastolic = bpDiastolic !== undefined && bpDiastolic !== "" ? Number(bpDiastolic) : null;
  // Mirrors the min/max already on the form's number inputs — enforced again here so a
  // bypassed/absent client-side check can't write a nonsensical reading.
  if (w !== null && (Number.isNaN(w) || w <= 0 || w > 500)) {
    throw new Error("Weight must be between 1 and 500 kg.");
  }
  if (h !== null && (Number.isNaN(h) || h <= 0 || h > 250)) {
    throw new Error("Height must be between 1 and 250 cm.");
  }
  if (systolic !== null && (Number.isNaN(systolic) || systolic < 40 || systolic > 250)) {
    throw new Error("Systolic blood pressure must be between 40 and 250 mmHg.");
  }
  if (diastolic !== null && (Number.isNaN(diastolic) || diastolic < 30 || diastolic > 160)) {
    throw new Error("Diastolic blood pressure must be between 30 and 160 mmHg.");
  }
  const data = unwrap(
    await supabase.rpc("update_patient_vitals", {
      p_patient_id: patientId,
      p_weight: w,
      p_height: h,
      p_bp_systolic: systolic,
      p_bp_diastolic: diastolic,
    })
  );
  return rowToPatient(data);
}

// ---------- Health summary (BMI / BP) — pure functions, no DB access ----------

export function computeBMI(weight, height) {
  if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) return null;
  const heightMeters = height / 100;
  return Math.round((weight / (heightMeters * heightMeters)) * 10) / 10;
}

export function bmiCategory(bmi) {
  if (bmi == null) return "N/A";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function bpCategory(systolic, diastolic) {
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return "N/A";
  if (systolic >= 180 || diastolic >= 120) return "Hypertensive Crisis";
  if (systolic >= 140 || diastolic >= 90) return "Hypertension Stage 2";
  if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) return "Hypertension Stage 1";
  if (systolic >= 120 && systolic < 130 && diastolic < 80) return "Elevated";
  if (systolic < 120 && diastolic < 80) return "Normal";
  return "N/A";
}

export function getHealthSummary(patient) {
  const vitals = patient.vitals || {};
  const bmi = computeBMI(vitals.weight, vitals.height);
  return {
    weight: vitals.weight ?? null,
    height: vitals.height ?? null,
    bmi,
    bmiCategory: bmiCategory(bmi),
    bpSystolic: vitals.bpSystolic ?? null,
    bpDiastolic: vitals.bpDiastolic ?? null,
    bpCategory: bpCategory(vitals.bpSystolic, vitals.bpDiastolic),
  };
}

// ---------- Visits ----------

export async function createVisit({ patientId, doctorId, date, illness, slot, isWalkIn, paymentMode }) {
  // Slot-capacity check and queue_number assignment happen atomically inside the
  // create_visit Postgres function (see supabase.sql) instead of here, so two concurrent
  // booking requests for the same doctor/date can't both pass a JS-side check before
  // either commits.
  const data = unwrap(
    await supabase.rpc("create_visit", {
      p_patient_id: patientId,
      p_doctor_id: doctorId,
      p_date: date,
      p_illness: illness,
      p_slot: slot,
      p_is_walk_in: !!isWalkIn,
      p_payment_mode: paymentMode || null,
    })
  );
  return rowToVisit(data);
}

// Doctor/registration-desk-only: books a visit on a patient's behalf (the walk-in
// workflow's last step, after search-or-register). Goes through
// create_visit_by_staff (see supabase.sql), which shares create_visit's slot-
// capacity/queue-number/duplicate-guard logic but authorizes the caller as the
// clinic (doctor themselves, or their own registration desk) rather than the patient
// -- doctorId must be the caller's own clinic, enforced server-side regardless of
// what's passed here.
export async function createVisitByStaff({ patientId, doctorId, date, illness, slot, isWalkIn, paymentMode }) {
  const data = unwrap(
    await supabase.rpc("create_visit_by_staff", {
      p_patient_id: patientId,
      p_doctor_id: doctorId,
      p_date: date,
      p_illness: illness,
      p_slot: slot,
      p_is_walk_in: !!isWalkIn,
      p_payment_mode: paymentMode || null,
    })
  );
  return rowToVisit(data);
}

export async function getVisit(id) {
  const data = unwrap(await supabase.from("visits").select("*").eq("id", id).maybeSingle());
  return rowToVisit(data);
}

export async function getVisitsForPatient(patientId) {
  const data = unwrap(
    await supabase.from("visits").select("*").eq("patient_id", patientId).order("created_at", { ascending: false })
  );
  return data.map(rowToVisit);
}

export async function getVisitsForDoctorOnDate(doctorId, date) {
  const data = unwrap(
    await supabase
      .from("visits")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("date", date)
      .order("queue_number", { ascending: true })
  );
  return data.map(rowToVisit);
}

export async function updateVisitStatus(visitId, status) {
  const data = unwrap(
    await supabase.from("visits").update({ status }).eq("id", visitId).select().maybeSingle()
  );
  return rowToVisit(data);
}

export async function getQueueStatus(visitId) {
  const visit = await getVisit(visitId);
  if (!visit) return null;
  const doctor = await getDoctor(visit.doctorId);
  const sameDay = unwrap(
    await supabase.from("visits").select("*").eq("doctor_id", visit.doctorId).eq("date", visit.date)
  ).map(rowToVisit);
  const patientsAhead = sameDay.filter(
    (v) => v.queueNumber < visit.queueNumber && v.status !== "completed" && v.status !== "cancelled"
  ).length;
  const AVG_CONSULT_MINUTES = 15;
  return {
    queueNumber: visit.queueNumber,
    patientsAhead,
    estimatedWaitMinutes: patientsAhead * AVG_CONSULT_MINUTES,
    doctorStatus: doctor ? doctor.status : "Unknown",
    visitStatus: visit.status,
  };
}

// ---------- Consultations ----------

export async function getConsultationForVisit(visitId) {
  const data = unwrap(await supabase.from("consultations").select("*").eq("visit_id", visitId).maybeSingle());
  return rowToConsultation(data);
}

export async function completeConsultation(visitId, data) {
  const visit = await getVisit(visitId);
  if (!visit) throw new Error("Visit not found.");
  if (visit.status !== "waiting" && visit.status !== "in-consultation") {
    throw new Error("This consultation has already been completed and can no longer be edited.");
  }
  const doctor = await getDoctor(visit.doctorId);
  const additionalBilling = (data.additionalBilling || []).map((item) => ({
    name: item.name?.trim(),
    amount: Number(item.amount),
  }));
  if (additionalBilling.some((item) => !item.name || !Number.isFinite(item.amount) || item.amount < 0)) {
    throw new Error("Each additional billing item needs a product or service and a valid price.");
  }
  const additionalBillingTotal = additionalBilling.reduce((total, item) => total + item.amount, 0);
  const paymentAmount = Math.round(((Number(doctor?.consultationFee) || 0) + additionalBillingTotal) * 100) / 100;
  const billSnapshot = {
    clinicName: doctor?.clinicName?.trim() || doctor?.name || "Clinic",
    clinicAddress: doctor?.clinicAddress || "",
    doctorName: doctor?.name || "",
    doctorPhone: doctor?.phone || "",
    gstin: doctor?.gstin?.trim() || null,
    consultationFee: Number(doctor?.consultationFee) || 0,
    issuedAt: new Date().toISOString(),
  };

  const payload = {
    symptoms: data.symptoms || "",
    findings: data.findings || "",
    diagnosis_notes: data.diagnosisNotes || "",
    clinic_medicines: data.clinicMedicines || [],
    outside_medicines: data.outsideMedicines || [],
    required_tests: data.requiredTests || [],
    additional_billing: additionalBilling,
  };

  const existingConsultation = unwrap(
    await supabase.from("consultations").select("*").eq("visit_id", visitId).maybeSingle()
  );

  let consultationRow;
  if (existingConsultation) {
    consultationRow = unwrap(
      await supabase
        .from("consultations")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", existingConsultation.id)
        .select()
        .single()
    );
  } else {
    consultationRow = unwrap(
      await supabase
        .from("consultations")
        .insert({ visit_id: visitId, ...payload })
        .select()
        .single()
    );
  }

  const updatedVisitRow = unwrap(
    await supabase.from("visits").update({ status: "awaiting-payment" }).eq("id", visitId).select().single()
  );

  const existingPayment = unwrap(await supabase.from("payments").select("*").eq("visit_id", visitId).maybeSingle());

  let paymentRow = existingPayment;
  if (!paymentRow) {
    paymentRow = unwrap(
      await supabase
        .from("payments")
        .insert({
          visit_id: visitId,
          amount: paymentAmount,
          bill_snapshot: billSnapshot,
          mode: visit.paymentMode || "cash",
          status: "pending",
        })
        .select()
        .single()
    );
  }

  return {
    visit: rowToVisit(updatedVisitRow),
    consultation: rowToConsultation(consultationRow),
    payment: rowToPayment(paymentRow),
  };
}

export async function getConsultationHistoryForPatient(patientId) {
  const visits = unwrap(
    await supabase.from("visits").select("*").eq("patient_id", patientId).order("created_at", { ascending: false })
  ).map(rowToVisit);

  const visitIds = visits.map((v) => v.id);
  const consultations = visitIds.length
    ? unwrap(await supabase.from("consultations").select("*").in("visit_id", visitIds)).map(rowToConsultation)
    : [];
  const payments = visitIds.length
    ? unwrap(await supabase.from("payments").select("*").in("visit_id", visitIds)).map(rowToPayment)
    : [];

  return visits.map((visit) => ({
    visit,
    consultation: consultations.find((c) => c.visitId === visit.id) || null,
    payment: payments.find((p) => p.visitId === visit.id) || null,
  }));
}

// ---------- Payments ----------

export async function getPaymentForVisit(visitId) {
  const data = unwrap(await supabase.from("payments").select("*").eq("visit_id", visitId).maybeSingle());
  return rowToPayment(data);
}

export async function uploadPaymentScreenshot(visitId, screenshotDataUrl) {
  const data = unwrap(
    await supabase
      .from("payments")
      .update({ screenshot_data_url: screenshotDataUrl, status: "awaiting-verification" })
      .eq("visit_id", visitId)
      .select()
      .maybeSingle()
  );
  return rowToPayment(data);
}

export async function markCashPaymentAwaitingVerification(visitId) {
  const data = unwrap(
    await supabase
      .from("payments")
      .update({ status: "awaiting-verification" })
      .eq("visit_id", visitId)
      .select()
      .maybeSingle()
  );
  return rowToPayment(data);
}

export async function verifyPayment(visitId) {
  const paymentRow = unwrap(
    await supabase
      .from("payments")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("visit_id", visitId)
      .select()
      .maybeSingle()
  );
  if (!paymentRow) return null;
  const visitRow = unwrap(
    await supabase.from("visits").update({ status: "completed" }).eq("id", visitId).select().maybeSingle()
  );
  if (!visitRow) return null;
  return { payment: rowToPayment(paymentRow), visit: rowToVisit(visitRow) };
}

export async function getPendingDuesForPatient(patientId) {
  const visits = unwrap(await supabase.from("visits").select("id").eq("patient_id", patientId));
  const visitIds = visits.map((v) => v.id);
  if (!visitIds.length) return 0;
  const payments = unwrap(
    await supabase.from("payments").select("*").in("visit_id", visitIds).neq("status", "verified")
  ).map(rowToPayment);
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

// ---------- Doctor dashboard / transactions ----------

export async function getDoctorDashboard(doctorId, date) {
  const visits = unwrap(
    await supabase
      .from("visits")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("date", date)
      .order("queue_number", { ascending: true })
  ).map(rowToVisit);

  const patientIds = [...new Set(visits.map((v) => v.patientId))];
  const visitIds = visits.map((v) => v.id);

  const patients = patientIds.length
    ? unwrap(await supabase.from("patients").select("*").in("id", patientIds)).map(rowToPatient)
    : [];
  const payments = visitIds.length
    ? unwrap(await supabase.from("payments").select("*").in("visit_id", visitIds)).map(rowToPayment)
    : [];

  const combined = visits.map((visit) => ({
    visit,
    patient: patients.find((p) => p.id === visit.patientId) || null,
    payment: payments.find((p) => p.visitId === visit.id) || null,
  }));

  return {
    all: combined,
    waiting: combined.filter((v) => v.visit.status === "waiting"),
    inConsultation: combined.filter((v) => v.visit.status === "in-consultation"),
    walkIns: combined.filter((v) => v.visit.isWalkIn),
    completed: combined.filter((v) => v.visit.status === "completed"),
    pendingPayments: combined.filter(
      (v) => v.payment && v.payment.status !== "verified" && v.visit.status === "awaiting-payment"
    ),
  };
}

function rangeStartDate(range, customFrom) {
  const now = new Date();
  if (range === "today") {
    return todayStr();
  }
  if (range === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (range === "monthly") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return customFrom || todayStr();
}

export async function getTransactionMetrics(doctorId, { range = "today", from, to } = {}) {
  const startDate = range === "custom" ? from : rangeStartDate(range);
  const endDate = range === "custom" ? to || todayStr() : todayStr();

  const visits = unwrap(
    await supabase
      .from("visits")
      .select("*")
      .eq("doctor_id", doctorId)
      .gte("date", startDate)
      .lte("date", endDate)
  ).map(rowToVisit);

  const visitIds = visits.map((v) => v.id);
  const payments = visitIds.length
    ? unwrap(await supabase.from("payments").select("*").in("visit_id", visitIds)).map(rowToPayment)
    : [];
  const verified = payments.filter((p) => p.status === "verified");

  return {
    range,
    startDate,
    endDate,
    totalAppointments: visits.length,
    totalRevenue: verified.reduce((sum, p) => sum + p.amount, 0),
    paidPatients: verified.length,
    pendingPayments: payments.filter((p) => p.status !== "verified").length,
  };
}

// ---------- Registration Desk (optional role) ----------

export async function getRegistrationStaffByFirebaseUid(uid) {
  const data = unwrap(
    await supabase.from("registration_staff").select("*").eq("firebase_uid", uid).maybeSingle()
  );
  return rowToRegistrationStaff(data);
}

export async function getRegistrationStaffById(id) {
  const data = unwrap(await supabase.from("registration_staff").select("*").eq("id", id).maybeSingle());
  return rowToRegistrationStaff(data);
}

// One query powering both dashboard panels (Payment Verification + Patient Tracking) —
// only ever selects id/name/contact from patients, never medical fields, since
// registration desk must never see consultation/medical-history data. Goes through
// get_registration_queue_patients (see supabase.sql) instead of a direct select so
// that column minimization is enforced at the database level, not just by this
// function only ever asking for those three columns.
export async function getRegistrationQueue(date = todayStr()) {
  const visits = unwrap(
    await supabase
      .from("visits")
      .select("*")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("queue_number", { ascending: true })
  ).map(rowToVisit);

  const patientIds = [...new Set(visits.map((v) => v.patientId))];
  const doctorIds = [...new Set(visits.map((v) => v.doctorId))];
  const visitIds = visits.map((v) => v.id);

  const patients = patientIds.length
    ? unwrap(await supabase.rpc("get_registration_queue_patients", { p_ids: patientIds }))
    : [];
  const doctors = doctorIds.length
    ? unwrap(await supabase.from("doctors").select("*").in("id", doctorIds)).map(rowToDoctor)
    : [];
  const payments = visitIds.length
    ? unwrap(await supabase.from("payments").select("*").in("visit_id", visitIds)).map(rowToPayment)
    : [];

  return visits.map((visit) => ({
    visit,
    patient: patients.find((p) => p.id === visit.patientId) || null,
    doctor: doctors.find((d) => d.id === visit.doctorId) || null,
    payment: payments.find((p) => p.visitId === visit.id) || null,
  }));
}

// Registration desk can only move a visit between waiting and in-consultation — see
// registration_set_visit_status in supabase.sql for the enforced boundaries.
export async function registrationSetVisitStatus(visitId, status) {
  const data = unwrap(
    await supabase.rpc("registration_set_visit_status", { p_visit_id: visitId, p_status: status })
  );
  return rowToVisit(data);
}

// Registration desk's payment verification action — mirrors verifyPayment()'s
// visit-status side effect so either entry point leaves the data consistent.
export async function registrationSetPaymentStatus(visitId, status) {
  const data = unwrap(
    await supabase.rpc("registration_set_payment_status", { p_visit_id: visitId, p_status: status })
  );
  return rowToPayment(data);
}

// ---------- Doctor-managed staff accounts ----------
// The Firebase Auth side of create/reset-password/activate/delete goes through
// netlify/functions/staff-*.js (lib/staffAdmin.js) — these functions only ever touch
// the registration_staff table itself, covered by the doctor-owns-this-row RLS
// policies in supabase.sql.

export async function getStaffForDoctor(doctorId) {
  const data = unwrap(
    await supabase.from("registration_staff").select("*").eq("doctor_id", doctorId).order("name")
  );
  return data.map(rowToRegistrationStaff);
}

export async function createRegistrationStaffRow({ doctorId, firebaseUid, name, email }) {
  const row = { doctor_id: doctorId, firebase_uid: firebaseUid, name, email, active: true };
  const { data, error } = await supabase.from("registration_staff").insert(row).select().single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("A staff account with this email already exists.");
    }
    throw new Error(toUserMessage(error));
  }
  return rowToRegistrationStaff(data);
}

export async function setRegistrationStaffActive(staffId, active) {
  const data = unwrap(
    await supabase.from("registration_staff").update({ active }).eq("id", staffId).select().maybeSingle()
  );
  return rowToRegistrationStaff(data);
}

export async function deleteRegistrationStaffRow(staffId) {
  const { error } = await supabase.from("registration_staff").delete().eq("id", staffId);
  if (error) throw new Error(toUserMessage(error));
}
