import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyCSSTokens,
  createPreset,
  themes,
  type ThemeId,
  type Corners,
  type Density,
  toCSSVariables,
} from '../theme/designSystem';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ui.theme.id';
const CORNER_STORAGE_KEY = 'ui.theme.corners';
const DENSITY_STORAGE_KEY = 'ui.theme.density';
const COLOR_MODE_KEY = 'theme'; // light/dark

export interface ThemeState {
  themeId: ThemeId;
  corners: Corners;
  density: Density;
  theme: Theme; // color mode
}

interface ThemeContextValue extends ThemeState {
  availableThemes: { id: ThemeId; name: string; description: string }[];
  setThemeId: (id: ThemeId) => void;
  setCorners: (corners: Corners) => void;
  setDensity: (density: Density) => void;
  toggleTheme: () => void;
  resetTheme: () => void;
}

const DEFAULT_STATE: ThemeState = {
  themeId: 'mint',
  corners: 'soft',
  density: 'comfortable',
  theme: 'light',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ThemeState>(() => {
    const storedThemeId = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ?? DEFAULT_STATE.themeId;
    const storedCorners = (localStorage.getItem(CORNER_STORAGE_KEY) as Corners | null) ?? DEFAULT_STATE.corners;
    const storedDensity = (localStorage.getItem(DENSITY_STORAGE_KEY) as Density | null) ?? DEFAULT_STATE.density;
    
    let storedMode = localStorage.getItem(COLOR_MODE_KEY) as Theme;
    if (!storedMode) {
      storedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return {
      themeId: themes[storedThemeId] ? storedThemeId : DEFAULT_STATE.themeId,
      corners: storedCorners ?? DEFAULT_STATE.corners,
      density: storedDensity ?? DEFAULT_STATE.density,
      theme: storedMode,
    };
  });

  useEffect(() => {
    // Apply design system variables
    const themeTokens = themes[state.themeId];
    const preset = createPreset(state.density, state.corners);
    const variables = toCSSVariables(themeTokens, preset);
    applyCSSTokens(variables);

    const root = document.documentElement;
    root.setAttribute('data-brand', state.themeId);
    root.setAttribute('data-corners', state.corners);
    root.setAttribute('data-density', state.density);
    
    // Apply light/dark mode for Tailwind
    root.setAttribute('data-theme', state.theme);
    // Standard tailwind dark class
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem(THEME_STORAGE_KEY, state.themeId);
    localStorage.setItem(CORNER_STORAGE_KEY, state.corners);
    localStorage.setItem(DENSITY_STORAGE_KEY, state.density);
    localStorage.setItem(COLOR_MODE_KEY, state.theme);
  }, [state]);

  const setThemeId = (themeId: ThemeId) => setState((prev) => ({ ...prev, themeId }));
  const setCorners = (corners: Corners) => setState((prev) => ({ ...prev, corners }));
  const setDensity = (density: Density) => setState((prev) => ({ ...prev, density }));
  const toggleTheme = () => setState((prev) => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  const resetTheme = () => setState(DEFAULT_STATE);

  const value = useMemo<ThemeContextValue>(() => ({
    ...state,
    availableThemes: Object.entries(themes).map(([id, meta]) => ({ id: id as ThemeId, name: meta.name, description: meta.description })),
    setThemeId,
    setCorners,
    setDensity,
    toggleTheme,
    resetTheme,
  }), [state]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
