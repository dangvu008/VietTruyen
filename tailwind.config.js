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
          deep: "#120f0d",
          surface: "#1a1512",
          elevated: "#241c17",
          hover: "#2e2420",
        },
        text: {
          primary: "#fff6ef",
          secondary: "#c8beb0",
          muted: "#8f7f73",
        },
        accent: {
          amber: "#f0c59a",
          gold: "#f0c59a",
          rose: "#e8708a",
          teal: "#2dd4bf",
          primary: "#f0c59a",
        },
        border: {
          subtle: "rgba(255,255,255,0.08)",
          DEFAULT: "rgba(255,255,255,0.12)",
          strong: "rgba(255,255,255,0.20)",
        },

        // Surface hierarchy (dark)
        surface: {
          DEFAULT: "#1a1512",
          dim: "#241c17",
          bright: "#2e2420",
          "container-lowest": "#15110e",
          "container-low": "#1c1713",
          container: "#221b16",
          "container-high": "#2c2420",
          "container-highest": "#362d28",
          variant: "#8d7d71",
          tint: "#f0c59a",
        },

        // Background
        background: "#120f0d",

        // Primary — warm amber-ink
        primary: {
          DEFAULT: "#f0c59a",
          container: "#4a2c14",
          fixed: "#c49060",
          "fixed-dim": "#a87040",
        },

        // Secondary
        secondary: {
          DEFAULT: "#2dd4bf",
          container: "#0a3d38",
          fixed: "#1a8c7c",
          "fixed-dim": "#0a6b60",
        },

        // Tertiary
        tertiary: {
          DEFAULT: "#e8708a",
          container: "#4a1530",
          fixed: "#d05070",
          "fixed-dim": "#b03050",
        },

        // Outlines
        outline: {
          DEFAULT: "rgba(255,255,255,0.18)",
          variant: "rgba(255,255,255,0.10)",
        },

        // Error
        error: {
          DEFAULT: "#f87171",
          container: "#4a1515",
        },

        // On-colors (Text/Icons)
        on: {
          surface: "#fff6ef",
          "surface-variant": "#c8beb0",
          background: "#fff6ef",
          primary: "#1b140f",
          "primary-container": "#f0c59a",
          secondary: "#041f1c",
          "secondary-container": "#0a3d38",
          tertiary: "#1b0815",
          "tertiary-container": "#4a1530",
          error: "#1b0808",
          "error-container": "#4a1515",
        },

        // Inverse
        inverse: {
          surface: "#f5f0ec",
          "on-surface": "#1a1512",
          primary: "#f0c59a",
        },
      },
      fontFamily: {
        sans: ["Inter", "Manrope", "system-ui", "-apple-system", "sans-serif"],
        display: ["Manrope", "system-ui", "-apple-system", "sans-serif"],
        body: ["Inter", "Manrope", "system-ui", "-apple-system", "sans-serif"],
        script: ["Newsreader", "serif"],
        serif: ["Playfair Display", "Lora", "serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        'editorial': 'cubic-bezier(0.2, 0, 0, 1)',
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'expo-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      boxShadow: {
        'ambient': '0 4px 24px rgba(0, 0, 0, 0.40)',
        'card': '0 2px 12px rgba(0, 0, 0, 0.30)',
        'focus': '0 0 0 3px rgba(240, 197, 154, 0.25)',
      },
      backgroundImage: {
        'primary-gradient': 'none',
        'ghost-border': 'none',
      },
      animation: {
        "fade-in": "fadeIn 0.4s cubic-bezier(0.2, 0, 0, 1)",
        "slide-in-right": "slideInRight 0.5s cubic-bezier(0.2, 0, 0, 1)",
        "slide-in-up": "slideInUp 0.4s cubic-bezier(0.2, 0, 0, 1)",
        "pulse-soft": "pulseSoft 2.5s cubic-bezier(0.2, 0, 0, 1) infinite",
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
