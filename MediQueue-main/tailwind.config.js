/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0A6EBD", dark: "#085A9E", light: "#EBF5FF" },
        accent: { DEFAULT: "#00C9A7", dark: "#00A88C" },
        bg: "#F0F4F8",
        surface: { DEFAULT: "#FFFFFF", 2: "#F8FAFC" },
        ink: { DEFAULT: "#1A2B3C", 2: "#64748B", 3: "#94A3B8" },
        border: { DEFAULT: "#E2E8F0", strong: "#CBD5E1" },
        sidebar: "#0F1B2D",
        pending: { bg: "#FFF7ED", text: "#C2410C", border: "#FDBA74" },
        accepted: { bg: "#EFF6FF", text: "#1D4ED8", border: "#93C5FD" },
        completed: { bg: "#F0FDF4", text: "#15803D", border: "#86EFAC" },
        rejected: { bg: "#FFF1F2", text: "#BE123C", border: "#FCA5A5" },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0,0,0,.05)",
        sm: "0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04)",
        md: "0 4px 12px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.04)",
        lg: "0 12px 32px rgba(0,0,0,.08), 0 4px 8px rgba(0,0,0,.04)",
        xl: "0 24px 48px rgba(0,0,0,.10), 0 8px 16px rgba(0,0,0,.05)",
      },
    },
  },
  plugins: [],
};
