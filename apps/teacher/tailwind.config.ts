import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/shared-ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
        },
        secondary: "#20970B",
        neutral: {
          DEFAULT: "#9C9C9C",
        },
        bg: "#FAFAFA",
        surface: "#FFFFFF",
        "text-primary": "#0A0A0A",
        "text-secondary": "#6B6B6B",
        "border-soft": "#E8E8EC",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      fontFamily: {
        display: ['"General Sans"', "system-ui", "sans-serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.08)",
        glow: "0 4px 12px rgba(99,102,241,0.35)",
        ring: "0 0 0 3px rgba(99,102,241,0.12)",
      },
      letterSpacing: {
        display: "-0.03em",
        tighter: "-0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
