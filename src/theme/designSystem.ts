import type { CSSProperties } from 'react';

export type ThemeId = 'sunrise' | 'mint' | 'lavender';
export type Density = 'comfortable' | 'compact';
export type Corners = 'rounded' | 'soft' | 'square';

export interface ThemeTokens {
  name: string;
  description: string;
  colors: {
    background: string;
    surface: string;
    surfaceSubtle: string;
    surfaceStrong: string;
    text: string;
    textMuted: string;
    primary: string;
    primarySoft: string;
    primaryStrong: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    border: string;
    outline: string;
  };
  gradients: {
    highlight: string;
  };
  shadows: {
    soft: string;
    medium: string;
    hard: string;
  };
  typography: {
    family: string;
    sizes: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    weightRegular: number;
    weightMedium: number;
    weightBold: number;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export interface ThemePreset {
  density: Density;
  corners: Corners;
  typographyScale: number;
}

const pastelShadow = (base: string): ThemeTokens['shadows'] => ({
  soft: `0 2px 8px ${base}`,
  medium: `0 8px 24px ${base}`,
  hard: `0 18px 42px ${base}`,
});

export const themes: Record<ThemeId, ThemeTokens> = {
  sunrise: {
    name: 'Sunrise',
    description: 'Sıcak pastel turuncular ve yumuşak krem tonları',
    colors: {
      background: '#fef7f1',
      surface: '#ffffff',
      surfaceSubtle: '#fdeede',
      surfaceStrong: '#f8d4bb',
      text: '#3c2f2f',
      textMuted: '#75635f',
      primary: '#ff7f57',
      primarySoft: '#ffb79d',
      primaryStrong: '#f9613a',
      success: '#3ea76a',
      warning: '#f4a259',
      danger: '#e86a68',
      info: '#5aa9e6',
      border: '#f3d8c6',
      outline: '#f8dccd',
    },
    gradients: {
      highlight: 'linear-gradient(135deg, rgba(255, 127, 87, 0.16) 0%, rgba(255, 200, 141, 0.22) 100%)',
    },
    shadows: pastelShadow('rgba(249, 97, 58, 0.15)'),
    typography: {
      family: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      sizes: {
        xs: '0.75rem',
        sm: '0.875rem',
        md: '1rem',
        lg: '1.125rem',
        xl: '1.5rem',
      },
      weightRegular: 400,
      weightMedium: 600,
      weightBold: 700,
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    radius: {
      sm: '6px',
      md: '12px',
      lg: '18px',
      xl: '26px',
    },
  },
  mint: {
    name: 'Fresh Mint',
    description: 'Canlı mint yeşili ve ferahlatıcı beyaz tonları',
    colors: {
      background: '#f3faf7',
      surface: '#ffffff',
      surfaceSubtle: '#e0f5eb',
      surfaceStrong: '#bae8d4',
      text: '#20362a',
      textMuted: '#4f6f61',
      primary: '#35c089',
      primarySoft: '#92e0c2',
      primaryStrong: '#1fa06d',
      success: '#30b27a',
      warning: '#f4c669',
      danger: '#ec7070',
      info: '#5ab0e6',
      border: '#c7eddc',
      outline: '#d3f3e5',
    },
    gradients: {
      highlight: 'linear-gradient(135deg, rgba(53, 192, 137, 0.12) 0%, rgba(146, 224, 194, 0.24) 100%)',
    },
    shadows: pastelShadow('rgba(31, 160, 109, 0.18)'),
    typography: {
      family: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      sizes: {
        xs: '0.75rem',
        sm: '0.875rem',
        md: '1rem',
        lg: '1.125rem',
        xl: '1.5rem',
      },
      weightRegular: 400,
      weightMedium: 600,
      weightBold: 700,
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    radius: {
      sm: '6px',
      md: '12px',
      lg: '18px',
      xl: '26px',
    },
  },
  lavender: {
    name: 'Soft Lavender',
    description: 'Pastel mor ve lila tonları ile sofistike bir görünüm',
    colors: {
      background: '#f7f3fb',
      surface: '#ffffff',
      surfaceSubtle: '#ede4f7',
      surfaceStrong: '#d6c2ef',
      text: '#2f2840',
      textMuted: '#625979',
      primary: '#7c69d8',
      primarySoft: '#b7abf2',
      primaryStrong: '#6555c0',
      success: '#4fb38d',
      warning: '#f2c46d',
      danger: '#ed6d8e',
      info: '#6da7f2',
      border: '#d8cbf2',
      outline: '#e4daf9',
    },
    gradients: {
      highlight: 'linear-gradient(135deg, rgba(124, 105, 216, 0.14) 0%, rgba(183, 171, 242, 0.26) 100%)',
    },
    shadows: pastelShadow('rgba(101, 85, 192, 0.16)'),
    typography: {
      family: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      sizes: {
        xs: '0.75rem',
        sm: '0.875rem',
        md: '1rem',
        lg: '1.125rem',
        xl: '1.5rem',
      },
      weightRegular: 400,
      weightMedium: 600,
      weightBold: 700,
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    radius: {
      sm: '6px',
      md: '12px',
      lg: '18px',
      xl: '26px',
    },
  },
};

export const createPreset = (density: Density, corners: Corners): ThemePreset => {
  const densityScale = density === 'compact' ? 0.96 : 1;
  const cornerScale = corners === 'rounded' ? 1.04 : corners === 'soft' ? 1 : 0.98;
  return {
    density,
    corners,
    typographyScale: Number((densityScale * cornerScale).toFixed(2)),
  };
};

export const cornerRadiusMap: Record<Corners, ThemeTokens['radius']> = {
  rounded: {
    sm: '10px',
    md: '16px',
    lg: '22px',
    xl: '30px',
  },
  soft: {
    sm: '6px',
    md: '12px',
    lg: '18px',
    xl: '26px',
  },
  square: {
    sm: '0px',
    md: '4px',
    lg: '6px',
    xl: '10px',
  },
};

export const densitySpacingMap: Record<Density, ThemeTokens['spacing']> = {
  comfortable: {
    xs: '6px',
    sm: '12px',
    md: '18px',
    lg: '28px',
    xl: '36px',
  },
  compact: {
    xs: '4px',
    sm: '8px',
    md: '14px',
    lg: '20px',
    xl: '28px',
  },
};

export const toCSSVariables = (
  theme: ThemeTokens,
  preset: ThemePreset,
): Record<string, string | number> => {
  const spacing = densitySpacingMap[preset.density];
  const radius = cornerRadiusMap[preset.corners];
  const scale = preset.typographyScale;

  return {
    '--color-bg': theme.colors.background,
    '--color-surface': theme.colors.surface,
    '--color-surface-subtle': theme.colors.surfaceSubtle,
    '--color-surface-strong': theme.colors.surfaceStrong,
    '--color-text': theme.colors.text,
    '--color-text-muted': theme.colors.textMuted,
    '--color-primary': theme.colors.primary,
    '--color-primary-soft': theme.colors.primarySoft,
    '--color-primary-strong': theme.colors.primaryStrong,
    '--color-success': theme.colors.success,
    '--color-warning': theme.colors.warning,
    '--color-danger': theme.colors.danger,
    '--color-info': theme.colors.info,
    '--color-border': theme.colors.border,
    '--color-outline': theme.colors.outline,
    '--color-highlight': theme.gradients.highlight,
    '--shadow-soft': theme.shadows.soft,
    '--shadow-medium': theme.shadows.medium,
    '--shadow-hard': theme.shadows.hard,
    '--font-family-base': theme.typography.family,
    '--font-size-xs': `calc(${theme.typography.sizes.xs} * ${scale})`,
    '--font-size-sm': `calc(${theme.typography.sizes.sm} * ${scale})`,
    '--font-size-md': `calc(${theme.typography.sizes.md} * ${scale})`,
    '--font-size-lg': `calc(${theme.typography.sizes.lg} * ${scale})`,
    '--font-size-xl': `calc(${theme.typography.sizes.xl} * ${scale})`,
    '--font-weight-regular': theme.typography.weightRegular,
    '--font-weight-medium': theme.typography.weightMedium,
    '--font-weight-bold': theme.typography.weightBold,
    '--space-xs': spacing.xs,
    '--space-sm': spacing.sm,
    '--space-md': spacing.md,
    '--space-lg': spacing.lg,
    '--space-xl': spacing.xl,
    '--radius-sm': radius.sm,
    '--radius-md': radius.md,
    '--radius-lg': radius.lg,
    '--radius-xl': radius.xl,
  } satisfies Record<string, string | number>;
};

export const applyCSSTokens = (variables: Record<string, string | number>) => {
  const root = document.documentElement;
  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, String(value));
  });
};

export const elevationToCSS = (level: 'soft' | 'medium' | 'hard'): CSSProperties['boxShadow'] => {
  switch (level) {
    case 'soft':
      return 'var(--shadow-soft)';
    case 'medium':
      return 'var(--shadow-medium)';
    case 'hard':
      return 'var(--shadow-hard)';
    default:
      return 'var(--shadow-soft)';
  }
};
