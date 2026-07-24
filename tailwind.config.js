/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ace: {
          bg: '#0e0e0e',
          card: '#1e1e1e',
          cyan: '#00b4d8',
          purple: '#7b2ff7',
          magenta: '#e91e8c',
          muted: '#a0a0a0',
          border: 'rgba(255, 255, 255, 0.06)',
        },
      },
    },
  },
  plugins: [],
};
