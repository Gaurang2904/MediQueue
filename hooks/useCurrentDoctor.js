"use client";

import { createContext, useContext } from "react";

// Populated by app/doctor/(portal)/layout.js, which already fetches and gates on the
// signed-in doctor's record — child pages read it from here instead of re-fetching the
// same row over the network.
export const DoctorContext = createContext(null);

export function useCurrentDoctor() {
  const doctor = useContext(DoctorContext);
  if (!doctor) {
    throw new Error("useCurrentDoctor must be used within the doctor portal layout.");
  }
  return doctor;
}
