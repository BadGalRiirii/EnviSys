/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A2E24",       // deep pine — headings, primary text
        moss: "#F6F7F3",      // app surface
        fern: "#2F6B4F",      // primary actions
        "fern-deep": "#24523D",
        line: "#DCE3DB",      // hairline borders
        amber: "#9A6B15",     // pending
        rust: "#9C3A2E",      // rejected / danger
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
