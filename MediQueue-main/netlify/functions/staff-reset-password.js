const { admin, httpError, requireDoctor, requireOwnedStaff } = require("./_lib/adminAuth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { doctorId, idToken } = await requireDoctor(event);
    const { firebaseUid, newPassword } = JSON.parse(event.body || "{}");
    if (!firebaseUid || !newPassword) {
      throw httpError(400, "Missing staff account or new password.");
    }
    if (newPassword.length < 6) {
      throw httpError(400, "Password must be at least 6 characters.");
    }

    await requireOwnedStaff(idToken, doctorId, firebaseUid);
    await admin.auth().updateUser(firebaseUid, { password: newPassword });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return { statusCode, body: JSON.stringify({ message: err.message || "Something went wrong." }) };
  }
};
