/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7aa8d5',
        success: '#43a047',
        error: '#e53935',
        info: '#1565c0',
        bg: '#f4f7f9',
        card: '#ffffff',
        border: '#e0e0e0',
      },
      boxShadow: {
        card: '0 8px 12px rgba(0,0,0,0.08)'
      }
    },
  },
  plugins: [],
}
