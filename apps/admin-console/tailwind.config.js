/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/admin-console/src/**/*.{html,ts}',
    './apps/admin-console/src/app/features/warehouse-movements/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#090d16',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          400: '#94a3b8',
          300: '#cbd5e1',
          100: '#f1f5f9',
        },
        amber: {
          500: '#f59e0b',
          400: '#fbbf24',
          300: '#fcd34d',
        },
        emerald: {
          500: '#10b981',
          400: '#34d399',
          300: '#6ee7b7',
        },
        rose: {
          600: '#e11d48',
          500: '#f43f5e',
          400: '#fb7185',
        },
      },
    },
  },
  plugins: [],
};
