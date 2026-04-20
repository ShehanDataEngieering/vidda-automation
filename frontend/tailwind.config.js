/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0F172A',
        'navy-light': '#1E293B',
        'navy-card': '#1E293B',
      },
    },
  },
  plugins: [],
};
