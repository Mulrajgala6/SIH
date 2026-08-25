import type { Config } from "tailwindcss";

/**
 * DAKSYNC design tokens — a restrained, India Post-inspired palette.
 * Seeded in Phase 0; refined in Phase 11 (UI polish). White-first, calm,
 * trustworthy. No neon / no glow.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4fb",
          100: "#d8e6f4",
          200: "#b6cee9",
          300: "#88aed8",
          400: "#5787c2",
          500: "#356aa9",
          600: "#254f87", // primary deep India Post blue
          700: "#1d3e6b",
          800: "#1a3457",
          900: "#182d49",
        },
        accent: {
          // restrained India Post-inspired red
          DEFAULT: "#b32b2b",
          600: "#a02525",
        },
        ink: "#0f172a", // near-black text
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        hindi: ["var(--font-noto-devanagari)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
