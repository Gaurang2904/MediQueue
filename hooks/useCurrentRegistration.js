"use client";

import { createContext, useContext } from "react";

// Populated by app/registration/(portal)/layout.js, which already fetches and gates on
// the signed-in registration desk staff member's record — child pages read it from here
// instead of re-fetching the same row over the network.
export const RegistrationContext = createContext(null);

export function useCurrentRegistration() {
  const registration = useContext(RegistrationContext);
  if (!registration) {
    throw new Error("useCurrentRegistration must be used within the registration portal layout.");
  }
  return registration;
}
