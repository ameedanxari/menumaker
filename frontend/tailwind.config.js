/** @type {import('tailwindcss').Config} */
const tokens = require('./tailwind-tokens.cjs');

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    ...tokens.theme,
  },
  plugins: [],
}
