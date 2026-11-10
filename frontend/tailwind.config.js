export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paddy: {
          50: "#f0faf3",
          100: "#dcf3e3",
          200: "#bbe6c9",
          300: "#8dd2a6",
          400: "#58b67c",
          500: "#35995d",
          600: "#257b49",
          700: "#1f623c",
          800: "#1c4e33",
          900: "#18402b",
        },
        wewa: {
          50: "#eff8fc",
          100: "#d8eef7",
          200: "#b5def0",
          300: "#81c6e4",
          400: "#46a6d3",
          500: "#2389bb",
          600: "#186e9d",
          700: "#175980",
          800: "#184b6a",
          900: "#193f59",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Sinhala", "Noto Sans Tamil", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,40,32,0.04), 0 4px 16px rgba(16,40,32,0.06)",
      },
    },
  },
  plugins: [],
};
