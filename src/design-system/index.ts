// src/design-system/index.ts
// Design System Main Entry

// Components
export * from './components';

// Theme (for JS access to theme values if needed)
export const theme = {
    colors: {
        primary: {
            50: '#eef2ff',
            100: '#e0e7ff',
            500: '#6366f1',
            600: '#4f46e5',
            700: '#4338ca',
        },
        neutral: {
            0: '#ffffff',
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            500: '#64748b',
            900: '#0f172a',
        },
        success: { 500: '#10b981', 600: '#059669' },
        warning: { 500: '#f59e0b', 600: '#d97706' },
        error: { 500: '#f43f5e', 600: '#e11d48' },
    },
    spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
    },
    radii: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px',
    },
} as const;
