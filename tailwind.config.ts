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
        whatsapp: {
          green: "#16A34A",
          bright: "#25D366",
          teal: "#075E54",
          dark: "#0B141A",
          bubbleOut: "#D9FDD3",
          bubbleIn: "#FFFFFF",
          canvas: "#EFEAE2",
          pillBg: "#DCFCE7",
          pillText: "#15803D",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
