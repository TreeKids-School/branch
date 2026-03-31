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
          50: '#f0f9f1',
          100: '#dcf0de',
          200: '#bbe1c0',
          500: '#28A745', // Tree Kids Green
          600: '#21913c',
          700: '#1d7a33',
        },
        wood: {
          50: '#f9f6f4',
          100: '#f1ece8',
          200: '#e5dcd6',
          500: '#8B5E3C', // Trunk Brown
          600: '#754f32',
          700: '#5f4029',
        },
        apple: {
          50: '#fef5f5',
          100: '#fdebeb',
          200: '#fcd3d3',
          500: '#DC3545', // Apple Red
          600: '#c22f3d',
          700: '#a82935',
        },
        clay: {
          50: '#faf7f2',
          500: '#D2B48C', // Tan
          600: '#C19A6B',
        },
        sage: {
          50: '#f4f7f4',
          500: '#8A9A8A', // Muted Green
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 10px 40px -10px rgba(0, 0, 0, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.03)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      transitionProperty: {
        'column': 'width, max-width, min-width, padding, margin, opacity, border',
      },
      transitionTimingFunction: {
        'drawer': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '400': '400ms',
      }
    },
  },
  plugins: [],
}
