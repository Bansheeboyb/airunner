import baseConfig from "tailwind-config";
import type { Config } from "tailwindcss";

const config: Config = {
  presets: [baseConfig],
  darkMode: "class",
  content: [
    "./layouts/**/*.{vue,ts}",
    "./modules/**/*.{vue,ts}",
    "./pages/**/*.{vue,ts}",
  ],
  safelist: ["ml-2", "ml-4", "ml-6", "ml-8"],
  theme: {
    extend: {
      // Add the background image, animations, etc. we discussed earlier
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23172554' fill-opacity='0.2'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3Cpath d='M6 5V0H5v5H0v1h5v94h1V6h94V5H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
      boxShadow: {
        neon: "0 0 5px #2CA9FF, 0 0 25px #2CA9FF",
        "neon-strong": "0 0 10px #2CA9FF, 0 0 30px #2CA9FF, 0 0 60px #2CA9FF",
        "neon-purple": "0 0 5px #9D5CFF, 0 0 25px #9D5CFF",
      },
      // Add the crypto color palettes
      colors: {
        "crypto-blue": {
          100: "#DFF6FF",
          200: "#B3E7FF",
          300: "#86D3FF",
          400: "#5ABEFF",
          500: "#2CA9FF",
          600: "#0066CC",
          700: "#0052A3",
          800: "#003D7A",
          900: "#002952",
        },
        "crypto-purple": {
          100: "#F3E8FF",
          200: "#E4CCFF",
          300: "#D1AFFF",
          400: "#B989FF",
          500: "#9D5CFF",
          600: "#7E39DB",
          700: "#6025B5",
          800: "#451A8C",
          900: "#2D1066",
        },
        "crypto-teal": {
          100: "#CCFCF1",
          200: "#99F6E9",
          300: "#5EEDD7",
          400: "#33D9BE",
          500: "#14B8A6",
          600: "#0E9384",
          700: "#0A6F62",
          800: "#064B42",
          900: "#03302A",
        },
        "crypto-dark": {
          100: "#CCD6E3",
          200: "#99ADC8",
          300: "#6683AD",
          400: "#3F5A82",
          500: "#1E293B",
          600: "#17202F",
          700: "#111827",
          800: "#0B101B",
          900: "#050810",
        },
        "crypto-light": {
          100: "#FFFFFF",
          200: "#F8FAFC",
          300: "#F1F5F9",
          400: "#E2E8F0",
          500: "#CBD5E1",
          600: "#94A3B8",
          700: "#64748B",
          800: "#475569",
          900: "#1E293B",
        },
      },
    },
  },
};

export default config;
