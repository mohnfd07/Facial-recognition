/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'subtle-pulse': 'subtlePulse 3s ease-in-out infinite',
      },
      keyframes: {
        subtlePulse: {
          '0%, 100%': { boxShadow: '0 0 15px 0 rgba(99, 102, 241, 0.3)' },
          '50%': { boxShadow: '0 0 25px 5px rgba(99, 102, 241, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
