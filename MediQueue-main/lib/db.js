// Browser-local mock database. Collection names and shapes mirror the
// Firestore collections in the SRS (patients, doctors, visits,
// consultations, payments) so this module can be swapped for real
// Firestore calls later without changing callers in app/.
//
// Data lives in the browser's localStorage (per-device, per-browser) so the
// whole app can run as a static export with no server/database of its own.

const DB_KEY = "mediqueue-db";

const SEED_DB = {
  doctors: [
    {
      id: "doc1",
      name: "Dr. Ayesha Kulkarni",
      username: "drayesha",
      password: "doctor123",
      qrCodeUrl: "/doctor-qr.svg",
      consultationFee: 500,
      status: "Available",
      slotConfig: { startTime: "09:00", endTime: "13:00", durationMinutes: 20, capacityPerSlot: 1 },
    },
  ],
  patients: [],
  visits: [],
  consultations: [],
  payments: [],
};

function readDb() {
  if (typeof window === "undefined") return SEED_DB;
  const raw = window.localStorage.getItem(DB_KEY);
  if (!raw) {
    writeDb(SEED_DB);
    return SEED_DB;
  }
  return JSON.parse(raw);
}

function writeDb(db) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function newId() {
  return crypto.randomUUID();
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Doctors ----------

export function getDoctors() {
  return readDb().doctors;
}

export function getDoctor(id) {
  return readDb().doctors.find((d) => d.id === id) || null;
}

export function checkDoctorLogin(username, password) {
  const doctor = readDb().doctors.find((d) => d.username === username && d.password === password);
  return doctor || null;
}

export function setDoctorStatus(doctorId, status) {
  const db = readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return null;
  doctor.status = status;
  writeDb(db);
  return doctor;
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

export function getSlotsForDate(doctorId, date) {
  const db = readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return [];
  const allSlots = generateSlotsForDoctor(doctor);
  const dayVisits = db.visits.filter(
    (v) => v.doctorId === doctorId && v.date === date && v.status !== "cancelled"
  );
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

export function getPatientByContact(contact) {
  return readDb().patients.find((p) => p.contact === contact) || null;
}

export function getPatients() {
  return [...readDb().patients].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPatientById(id) {
  return readDb().patients.find((p) => p.id === id) || null;
}

export function createPatient({
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
  bpSystolic,
  bpDiastolic,
}) {
  const db = readDb();
  if (db.patients.some((p) => p.contact === contact)) {
    throw new Error("A patient with this contact number is already registered.");
  }
  const patient = {
    id: newId(),
    photoDataUrl: photoDataUrl || null,
    name,
    address,
    contact,
    age: Number(age),
    gender,
    bloodGroup: bloodGroup || null,
    mobility: mobility || null,
    pastDiseaseHistory: !!pastDiseaseHistory,
    pastDiseaseDetails: pastDiseaseDetails || "",
    allergies: !!allergies,
    allergyDetails: allergyDetails || "",
    dietaryRestrictions: !!dietaryRestrictions,
    vitals: {
      weight: weight !== undefined && weight !== "" ? Number(weight) : null,
      height: height !== undefined && height !== "" ? Number(height) : null,
      bpSystolic: bpSystolic !== undefined && bpSystolic !== "" ? Number(bpSystolic) : null,
      bpDiastolic: bpDiastolic !== undefined && bpDiastolic !== "" ? Number(bpDiastolic) : null,
    },
    registeredAt: new Date().toISOString(),
  };
  db.patients.push(patient);
  writeDb(db);
  return patient;
}

// ---------- Health summary (BMI / BP) ----------

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

export function createVisit({ patientId, doctorId, date, illness, slot, isWalkIn, paymentMode }) {
  const db = readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) throw new Error("Doctor not found.");

  const dayVisits = db.visits.filter(
    (v) => v.doctorId === doctorId && v.date === date && v.status !== "cancelled"
  );
  const bookedForSlot = dayVisits.filter((v) => v.slot === slot).length;
  if (bookedForSlot >= doctor.slotConfig.capacityPerSlot) {
    throw new Error("This slot is fully booked. Please choose another slot.");
  }

  const visit = {
    id: newId(),
    patientId,
    doctorId,
    date,
    illness,
    slot,
    isWalkIn: !!isWalkIn,
    queueNumber: dayVisits.length + 1,
    paymentMode: paymentMode || null,
    status: "waiting", // waiting -> in-consultation -> awaiting-payment -> completed
    createdAt: new Date().toISOString(),
  };
  db.visits.push(visit);
  writeDb(db);
  return visit;
}

export function getVisit(id) {
  return readDb().visits.find((v) => v.id === id) || null;
}

export function getVisitsForPatient(patientId) {
  return readDb()
    .visits.filter((v) => v.patientId === patientId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function getVisitsForDoctorOnDate(doctorId, date) {
  return readDb()
    .visits.filter((v) => v.doctorId === doctorId && v.date === date)
    .sort((a, b) => a.queueNumber - b.queueNumber);
}

export function updateVisitStatus(visitId, status) {
  const db = readDb();
  const visit = db.visits.find((v) => v.id === visitId);
  if (!visit) return null;
  visit.status = status;
  writeDb(db);
  return visit;
}

export function getQueueStatus(visitId) {
  const db = readDb();
  const visit = db.visits.find((v) => v.id === visitId);
  if (!visit) return null;
  const doctor = db.doctors.find((d) => d.id === visit.doctorId);
  const sameDay = db.visits.filter((v) => v.doctorId === visit.doctorId && v.date === visit.date);
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

export function getConsultationForVisit(visitId) {
  return readDb().consultations.find((c) => c.visitId === visitId) || null;
}

export function completeConsultation(visitId, data) {
  const db = readDb();
  const visit = db.visits.find((v) => v.id === visitId);
  if (!visit) throw new Error("Visit not found.");
  const doctor = db.doctors.find((d) => d.id === visit.doctorId);

  let consultation = db.consultations.find((c) => c.visitId === visitId);
  const payload = {
    symptoms: data.symptoms || "",
    findings: data.findings || "",
    diagnosisNotes: data.diagnosisNotes || "",
    clinicMedicines: data.clinicMedicines || [],
    outsideMedicines: data.outsideMedicines || [],
    followUp: data.followUp || "",
    lifestyleAdvice: data.lifestyleAdvice || "",
    precautions: data.precautions || "",
  };

  if (consultation) {
    Object.assign(consultation, payload, { updatedAt: new Date().toISOString() });
  } else {
    consultation = {
      id: newId(),
      visitId,
      ...payload,
      createdAt: new Date().toISOString(),
    };
    db.consultations.push(consultation);
  }

  visit.status = "awaiting-payment";

  let payment = db.payments.find((p) => p.visitId === visitId);
  if (!payment) {
    payment = {
      id: newId(),
      visitId,
      amount: doctor ? doctor.consultationFee : 0,
      mode: visit.paymentMode || "cash",
      status: "pending",
      screenshotDataUrl: null,
      verifiedAt: null,
      createdAt: new Date().toISOString(),
    };
    db.payments.push(payment);
  }

  writeDb(db);
  return { visit, consultation, payment };
}

export function getConsultationHistoryForPatient(patientId) {
  const db = readDb();
  const visits = db.visits
    .filter((v) => v.patientId === patientId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return visits.map((visit) => ({
    visit,
    consultation: db.consultations.find((c) => c.visitId === visit.id) || null,
    payment: db.payments.find((p) => p.visitId === visit.id) || null,
  }));
}

// ---------- Payments ----------

export function getPaymentForVisit(visitId) {
  return readDb().payments.find((p) => p.visitId === visitId) || null;
}

export function uploadPaymentScreenshot(visitId, screenshotDataUrl) {
  const db = readDb();
  const payment = db.payments.find((p) => p.visitId === visitId);
  if (!payment) return null;
  payment.screenshotDataUrl = screenshotDataUrl;
  payment.status = "awaiting-verification";
  writeDb(db);
  return payment;
}

export function markCashPaymentAwaitingVerification(visitId) {
  const db = readDb();
  const payment = db.payments.find((p) => p.visitId === visitId);
  if (!payment) return null;
  payment.status = "awaiting-verification";
  writeDb(db);
  return payment;
}

export function verifyPayment(visitId) {
  const db = readDb();
  const payment = db.payments.find((p) => p.visitId === visitId);
  const visit = db.visits.find((v) => v.id === visitId);
  if (!payment || !visit) return null;
  payment.status = "verified";
  payment.verifiedAt = new Date().toISOString();
  visit.status = "completed";
  writeDb(db);
  return { payment, visit };
}

export function getPendingDuesForPatient(patientId) {
  const db = readDb();
  const patientVisitIds = db.visits.filter((v) => v.patientId === patientId).map((v) => v.id);
  return db.payments
    .filter((p) => patientVisitIds.includes(p.visitId) && p.status !== "verified")
    .reduce((sum, p) => sum + p.amount, 0);
}

// ---------- Doctor dashboard / transactions ----------

export function getDoctorDashboard(doctorId, date) {
  const db = readDb();
  const visits = db.visits
    .filter((v) => v.doctorId === doctorId && v.date === date)
    .sort((a, b) => a.queueNumber - b.queueNumber)
    .map((visit) => ({
      visit,
      patient: db.patients.find((p) => p.id === visit.patientId) || null,
      payment: db.payments.find((p) => p.visitId === visit.id) || null,
    }));

  return {
    all: visits,
    waiting: visits.filter((v) => v.visit.status === "waiting"),
    inConsultation: visits.filter((v) => v.visit.status === "in-consultation"),
    walkIns: visits.filter((v) => v.visit.isWalkIn),
    completed: visits.filter((v) => v.visit.status === "completed"),
    pendingPayments: visits.filter(
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

export function getTransactionMetrics(doctorId, { range = "today", from, to } = {}) {
  const db = readDb();
  const startDate = range === "custom" ? from : rangeStartDate(range);
  const endDate = range === "custom" ? to || todayStr() : todayStr();

  const visits = db.visits.filter(
    (v) => v.doctorId === doctorId && v.date >= startDate && v.date <= endDate
  );
  const visitIds = visits.map((v) => v.id);
  const payments = db.payments.filter((p) => visitIds.includes(p.visitId));
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
