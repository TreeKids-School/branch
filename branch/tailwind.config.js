/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tree: {
          50: '#e8f5e9',
          100: '#c8e6c9',
          500: '#28A745', // Tree Kids Green
          600: '#218838',
          700: '#1e7e34',
        },
        apple: {
          500: '#DC3545', // Apple Red
          600: '#c82333',
        },
        wood: {
          500: '#795548', // Wood Brown
          600: '#5d4037',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
