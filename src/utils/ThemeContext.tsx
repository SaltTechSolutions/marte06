import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  applyCSSTokens,
  createPreset,
  themes,
  toCSSVariables,
} from '../theme/designSystem';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LIGHT_THEME_ID = 'mint';
const LIGHT_CORNERS = 'soft';
const LIGHT_DENSITY = 'comfortable';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme_mode');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const baseTheme = themes[LIGHT_THEME_ID];
    
    // For dark mode, we dynamically adjust background/surface colors to remain cohesive with mint theme.
    // The details are also overridden in theme.css under html.dark
    const activeColors = mode === 'dark' ? {
      ...baseTheme.colors,
      background: '#090e0c',
      surface: '#111a16',
      surfaceSubtle: '#17241e',
      surfaceStrong: '#1e2e26',
      text: '#e2f2eb',
      textMuted: '#9bbcae',
      border: '#1a2922',
      borderStrong: '#23382e',
    } : baseTheme.colors;

    const variables = toCSSVariables(
      { ...baseTheme, colors: activeColors },
      createPreset(LIGHT_DENSITY, LIGHT_CORNERS),
    );
    applyCSSTokens(variables);

    const root = document.documentElement;
    root.setAttribute('data-brand', LIGHT_THEME_ID);
    root.setAttribute('data-corners', LIGHT_CORNERS);
    root.setAttribute('data-density', LIGHT_DENSITY);

    if (mode === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      root.setAttribute('data-theme', 'light');
    }

    localStorage.setItem('theme_mode', mode);
  }, [mode]);

  const toggleMode = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode ThemeProvider içinde kullanılmalıdır');
  }
  return context;
};
