/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/admin-console/src/**/*.{html,ts}',
    './apps/admin-console/src/app/features/warehouse-movements/**/*.{html,ts}',
    './apps/rf-terminal/src/**/*.{html,ts}',
    './libs/**/*.{html,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
