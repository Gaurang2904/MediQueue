// Creates a Firebase account for a patient being linked to an existing walk-in
// record (see components/PatientSearchAndRegister.js / lib/patientAdmin.js). Mirrors
// staff-create.js exactly, except authorized via requireDoctorOrStaff (either portal
// can do this) instead of doctor-only. The uid this returns is meant to be passed
// straight into link_patient_firebase_uid (see supabase.sql) -- nothing else should
// ever use it, and the caller (PatientSearchAndRegister) rolls this account back if
// that link call fails, so a failed linking attempt never leaves an orphaned account.
const { admin, httpError, requireDoctorOrStaff } = require("./_lib/adminAuth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    await requireDoctorOrStaff(event);
    const { name, email, password } = JSON.parse(event.body || "{}");
    if (!name || !email || !password) {
      throw httpError(400, "Name, email, and password are required.");
    }
    if (password.length < 6) {
      throw httpError(400, "Password must be at least 6 characters.");
    }

    const userRecord = await admin.auth().createUser({ email, password, displayName: name });
    return { statusCode: 200, body: JSON.stringify({ uid: userRecord.uid }) };
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      return { statusCode: 409, body: JSON.stringify({ message: "An account with this email already exists." }) };
    }
    const statusCode = err.statusCode || 500;
    return { statusCode, body: JSON.stringify({ message: err.message || "Something went wrong." }) };
  }
};
