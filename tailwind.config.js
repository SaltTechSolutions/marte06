/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  safelist: [
    // Gradient directions
    'bg-gradient-to-r',
    // From colors (500)
    'from-blue-500', 'from-emerald-500', 'from-purple-500', 'from-pink-500', 'from-indigo-500', 'from-red-500', 'from-yellow-500', 'from-teal-500', 'from-orange-500', 'from-cyan-500', 'from-rose-500', 'from-lime-500',
    // To colors (600)
    'to-blue-600', 'to-emerald-600', 'to-purple-600', 'to-pink-600', 'to-indigo-600', 'to-red-600', 'to-yellow-600', 'to-teal-600', 'to-orange-600', 'to-cyan-600', 'to-rose-600', 'to-lime-600',
  ],
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
