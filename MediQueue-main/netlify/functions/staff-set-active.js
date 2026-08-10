const { admin, httpError, requireDoctor, requireOwnedStaff } = require("./_lib/adminAuth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { doctorId, idToken } = await requireDoctor(event);
    const { firebaseUid, active } = JSON.parse(event.body || "{}");
    if (!firebaseUid || typeof active !== "boolean") {
      throw httpError(400, "Missing staff account or active flag.");
    }

    await requireOwnedStaff(idToken, doctorId, firebaseUid);
    await admin.auth().updateUser(firebaseUid, { disabled: !active });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return { statusCode, body: JSON.stringify({ message: err.message || "Something went wrong." }) };
  }
};
