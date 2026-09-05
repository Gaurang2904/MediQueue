"use client";

import { createContext, useContext } from "react";

// Populated by app/admin/(portal)/layout.js, which already fetches and gates on the
// signed-in admin's record — child pages read it from here instead of re-fetching the
// same row over the network. Mirrors hooks/useCurrentDoctor.js.
export const AdminContext = createContext(null);

export function useCurrentAdmin() {
  const admin = useContext(AdminContext);
  if (!admin) {
    throw new Error("useCurrentAdmin must be used within the admin portal layout.");
  }
  return admin;
}
