function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

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
          50: withOpacity('--color-tree-50-rgb'),
          100: withOpacity('--color-tree-100-rgb'),
          200: withOpacity('--color-tree-200-rgb'),
          300: withOpacity('--color-tree-300-rgb'),
          400: withOpacity('--color-tree-400-rgb'),
          500: withOpacity('--color-tree-500-rgb'),
          600: withOpacity('--color-tree-600-rgb'),
          700: withOpacity('--color-tree-700-rgb'),
          800: withOpacity('--color-tree-800-rgb'),
          900: withOpacity('--color-tree-900-rgb'),
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
