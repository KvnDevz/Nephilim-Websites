/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          well: "#0c0c0c",
          dock: "#111111",
          canvas: "#141414",
          recessed: "#181818",
          "surface-subtle": "#1c1c1c",
          "surface-elevated": "#222222",
          "surface-active": "#282828",
          selection: "#303030",
        },
        border: {
          structural: "#222222",
          subtle: "#2a2a2a",
          active: "#3a3a3a",
        },
        fg: {
          bright: "#f0efeb",
          primary: "#c8c6c1",
          secondary: "#8e8c87",
          muted: "#6e6c68",
        },
        accent: {
          blue: "#88c0d0",
          cyan: "#8fbcbb",
          green: "#a3be8c",
          yellow: "#ebcb8b",
          orange: "#d08770",
          red: "#e06c75",
          purple: "#b48ead",
        },
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"Martian Mono"', "Consolas", "monospace"],
      },
      boxShadow: {
        panel: "0 16px 40px -12px rgba(0, 0, 0, 0.75)",
      },
    },
  },
  plugins: [],
};
