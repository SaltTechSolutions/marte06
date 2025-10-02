import { colors, type ColorTokens } from './tokens';

export type ThemeMode = 'light' | 'dark';

export type ThemeDefinition = {
  mode: ThemeMode;
  palette: ColorTokens;
  surface: {
    background: string;
    elevated: string;
    hover: string;
    border: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    disabled: string;
  };
};

export const lightTheme: ThemeDefinition = {
  mode: 'light',
  palette: colors,
  surface: {
    background: '#f9fafb',
    elevated: '#ffffff',
    hover: 'rgba(99, 102, 241, 0.08)',
    border: 'rgba(15, 23, 42, 0.08)',
  },
  text: {
    primary: '#0f172a',
    secondary: '#1f2937',
    muted: '#6b7280',
    disabled: '#9ca3af',
  },
};

export const darkTheme: ThemeDefinition = {
  mode: 'dark',
  palette: {
    ...colors,
    primary: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
  },
  surface: {
    background: '#0f172a',
    elevated: '#1e293b',
    hover: 'rgba(148, 163, 184, 0.16)',
    border: 'rgba(148, 163, 184, 0.24)',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#e2e8f0',
    muted: '#94a3b8',
    disabled: '#64748b',
  },
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export type ThemeName = keyof typeof themes;
