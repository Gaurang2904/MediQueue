// Shared contact-number normalization, mirroring public.normalize_contact() in
// supabase.sql -- strips everything but digits and keeps the last 10, so a search box,
// a freshly-typed form field, and a number with stray formatting all compare equal.
export function normalizeContact(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.slice(-10);
}

export function isValidContact(value) {
  return /^\d{10}$/.test(String(value || ""));
}
