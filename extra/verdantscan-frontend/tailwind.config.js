/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        leaf: "#4F6D44",
        forest: "#2D3A26",
        muted: "#5C6358",
        cream: "#F9F7F2",
        pale: "#E8EEDF",
        line: "#E5E1D8",
        gold: "#C2822A"
      },
      fontFamily: {
        serif: ['"Crimson Pro"', "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 50px rgba(45,58,38,0.08)"
      }
    }
  },
  plugins: []
};
