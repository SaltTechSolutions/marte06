export type ColorScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export type ColorTokens = {
  primary: ColorScale;
  secondary: ColorScale;
  success: ColorScale;
  warning: ColorScale;
  danger: ColorScale;
  neutral: ColorScale;
  accent: ColorScale;
};

export const colors: ColorTokens = {
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  secondary: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
  },
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  accent: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
};

export type FontFamilyTokens = {
  base: string;
  heading: string;
  mono: string;
};

export const fontFamilies: FontFamilyTokens = {
  base: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  heading: '"Poppins", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"Fira Code", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export type FontSizeTokens = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
};

export const fontSizes: FontSizeTokens = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
};

export type FontWeightTokens = {
  regular: number;
  medium: number;
  semibold: number;
  bold: number;
};

export const fontWeights: FontWeightTokens = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export type LineHeightTokens = {
  tight: string;
  snug: string;
  normal: string;
  relaxed: string;
};

export const lineHeights: LineHeightTokens = {
  tight: '1.2',
  snug: '1.35',
  normal: '1.5',
  relaxed: '1.7',
};

export type SpacingTokens = {
  none: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
};

export const spacing: SpacingTokens = {
  none: '0px',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
};

export type RadiusTokens = {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
};

export const radii: RadiusTokens = {
  none: '0px',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
};

export type ShadowTokens = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

export const shadows: ShadowTokens = {
  xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
  sm: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
  md: '0 4px 6px rgba(15, 23, 42, 0.1), 0 2px 4px rgba(15, 23, 42, 0.06)',
  lg: '0 10px 15px rgba(15, 23, 42, 0.12), 0 4px 6px rgba(15, 23, 42, 0.08)',
  xl: '0 20px 25px rgba(15, 23, 42, 0.15), 0 10px 10px rgba(15, 23, 42, 0.12)',
};

export type MotionTokens = {
  quick: string;
  standard: string;
  expressive: string;
  aggressive: string;
};

export const motion: MotionTokens = {
  quick: '120ms',
  standard: '200ms',
  expressive: '320ms',
  aggressive: '480ms',
};

export type ZIndexTokens = {
  base: number;
  sticky: number;
  dropdown: number;
  overlay: number;
  modal: number;
  toast: number;
  tooltip: number;
};

export const zIndex: ZIndexTokens = {
  base: 0,
  sticky: 100,
  dropdown: 300,
  overlay: 500,
  modal: 700,
  toast: 900,
  tooltip: 1100,
};

export type BreakpointTokens = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
};

export const breakpoints: BreakpointTokens = {
  xs: 360,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export const tokens = {
  colors,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  spacing,
  radii,
  shadows,
  motion,
  zIndex,
  breakpoints,
} as const;

export type DesignTokens = typeof tokens;
