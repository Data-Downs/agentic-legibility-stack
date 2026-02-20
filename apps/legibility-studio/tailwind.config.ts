import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // GOV.UK accent colors — kept for status indicators
        "govuk-blue": "#1d70b8",
        "govuk-dark-blue": "#003078",
        "govuk-black": "#0b0c0c",
        "govuk-white": "#ffffff",
        "govuk-red": "#d4351c",
        "govuk-yellow": "#ffdd00",
        "govuk-green": "#00703c",
        "govuk-light-grey": "#f3f2f1",
        "govuk-mid-grey": "#b1b4b6",
        "govuk-dark-grey": "#505a5f",
        // Studio palette
        "studio-sidebar": "#1a1a2e",
        "studio-sidebar-hover": "#16213e",
        "studio-sidebar-active": "#141428",
        "studio-topbar": "#0f0f23",
        "studio-accent": "#4f6ef7",
        "studio-body": "#f8f9fa",
        "studio-card": "#ffffff",
        "studio-border": "#e5e7eb",
      },
      fontFamily: {
        govuk: ['"GDS Transport"', '"nta"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
