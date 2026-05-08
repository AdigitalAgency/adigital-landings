/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ff8d01',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#feea00',
          foreground: '#2b2520',
        },
        accent: {
          DEFAULT: '#ff8d01',
        },
        background: '#ffffff',
        foreground: '#2b2520',
        muted: {
          DEFAULT: '#f4f4f4',
          foreground: '#666666',
        },
        border: '#e5e5e5',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
