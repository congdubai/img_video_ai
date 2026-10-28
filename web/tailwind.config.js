/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        doodle: {
          cream: '#FBF8F1',
          dark: '#1C1917',
          border: '#292524',
          accent: '#F59E0B',
          blue: '#3B82F6',
          muted: '#78716C',
        }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
