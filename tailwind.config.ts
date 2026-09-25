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
        monsoon: {
          deep: "#0B3B24",
          forest: "#14532D",
          emerald: "#166534",
          leaf: "#22C55E",
          light: "#DCFCE7",
          rain: "#0284C7",
          rainLight: "#E0F2FE",
          amber: "#D97706",
          danger: "#DC2626",
        },
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(11, 59, 36, 0.06), 0 2px 6px -1px rgba(11, 59, 36, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
