/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#0a1a0f',
          900: '#0f2318',
          800: '#162e1f',
          700: '#1e3d2a',
          600: '#275239',
        },
        brand: {
          green: '#4ade80',
          orange: '#fb923c',
          blue: '#60a5fa',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
