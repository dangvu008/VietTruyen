/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,tsx,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: "#0f0d0a",
          surface: "#1a1610",
          elevated: "#252118",
          hover: "#2e2820",
        },
        text: {
          primary: "#f5e6d0",
          secondary: "#a89880",
          muted: "#7a6e5c",
        },
        accent: {
          amber: "#d4a574",
          gold: "#e8c87a",
          rose: "#c47a7a",
          teal: "#7ab8a8",
        },
        border: {
          subtle: "#2a2420",
          DEFAULT: "#3a3228",
          strong: "#4a4038",
        },
      },
      fontFamily: {
        display: ["Lora", "Georgia", "serif"],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-in-up": "slideInUp 0.2s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
}
