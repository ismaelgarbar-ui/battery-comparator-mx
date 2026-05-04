import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        indeterminate: {
          "0%":   { transform: "translateX(-100%) scaleX(0.5)" },
          "50%":  { transform: "translateX(0%) scaleX(0.8)" },
          "100%": { transform: "translateX(100%) scaleX(0.5)" },
        },
      },
      animation: {
        indeterminate: "indeterminate 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
