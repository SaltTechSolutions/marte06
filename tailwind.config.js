/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        bg: 'var(--color-bg)',
        card: 'var(--color-card)',
        border: 'var(--color-border)',
      },
      boxShadow: {
        card: '0 8px 12px rgba(0,0,0,0.08)'
      }
    },
  },
  plugins: [],
}
