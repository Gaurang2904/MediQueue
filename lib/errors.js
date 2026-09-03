// Central place to turn a raw Supabase/Postgres error into something safe to show a
// user. Our own RPCs already raise human-written exception messages ("This slot is
// fully booked...", "A patient with this contact number is already registered.") --
// those read like plain English and are passed through unchanged. What this guards
// against is the OTHER kind of error reaching the UI verbatim: raw Postgres/PostgREST
// internals (an RLS policy rejection, a permission error, an expired-JWT message)
// that are meaningless -- or actively confusing -- to a clinic user.
//
// Never logs a full token, password, or credential -- only the error object Supabase's
// client already produces, which never contains those (see lib/supabase.js).

const RAW_ERROR_PATTERNS = [
  { test: /row-level security/i, message: "You don't have permission to do this." },
  { test: /permission denied/i, message: "You don't have permission to do this." },
  { test: /jwt|invalid signature|token is expired/i, message: "Your session has expired. Please sign in again." },
  { test: /duplicate key value violates unique constraint/i, message: "That record already exists." },
  { test: /invalid input syntax/i, message: "One of the values entered isn't valid. Please check the form and try again." },
  { test: /violates foreign key constraint/i, message: "That record no longer exists. Please refresh and try again." },
  { test: /violates not-null constraint/i, message: "Please fill in all required fields." },
];

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

// Wraps a raw error (from supabase-js, or any thrown Error) into a message safe to
// display. Always logs the technical detail to the console for development/debugging
// -- callers should still surface `error` itself to error-tracking if they have one,
// this only controls what reaches the UI.
export function toUserMessage(error, fallback = DEFAULT_FALLBACK) {
  const raw = (error && error.message) || String(error || "");
  if (process.env.NODE_ENV !== "production") {
    console.error("[db error]", error);
  } else {
    // Keep only the message in production logs, never the full error object (which
    // for some client libraries can carry request metadata) -- still no tokens ever,
    // since supabase-js errors never include the bearer token itself.
    console.error("[db error]", raw);
  }

  for (const pattern of RAW_ERROR_PATTERNS) {
    if (pattern.test.test(raw)) return pattern.message;
  }

  // Anything else is assumed to be one of our own RAISE EXCEPTION messages (already
  // human-written) or a short, safe message -- pass it through as-is. A message this
  // long is almost certainly not something we wrote by hand, so fall back instead of
  // risking a wall of raw internals reaching the screen.
  if (raw && raw.length > 0 && raw.length < 200) return raw;

  return fallback;
}
