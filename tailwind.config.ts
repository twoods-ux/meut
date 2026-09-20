import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: "#4070D0",
          50: "#EEF3FB",
          100: "#D9E4F7",
          200: "#B3C9EF",
          300: "#8DAEE7",
          400: "#6793DF",
          500: "#4070D0",
          600: "#2F56A8",
          700: "#1C4587",
          800: "#163560",
          900: "#0C1F3D",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)",
        card: "0 1px 3px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(28, 69, 135, 0.06)",
        lift: "0 8px 30px rgba(28, 69, 135, 0.12)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4070D0 0%, #1C4587 100%)",
        "auth-gradient":
          "linear-gradient(145deg, #0C1F3D 0%, #163560 45%, #1C4587 70%, #4070D0 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
