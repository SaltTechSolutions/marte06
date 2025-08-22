// src/components/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeName = 'light' | 'forest' | 'ocean';
export type PresetName = 'material' | 'simple' | 'modern';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  preset: PresetName;
  setPreset: (p: PresetName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';
const PRESET_STORAGE_KEY = 'app_preset';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>('light');
  const [preset, setPresetState] = useState<PresetName>('modern');

  // Load stored theme
  useEffect(() => {
    const storedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null);
    if (storedTheme === 'forest' || storedTheme === 'ocean' || storedTheme === 'light') {
      setThemeState(storedTheme);
    } else if (storedTheme === ('dark' as unknown as ThemeName)) {
      // Migrate legacy 'dark' theme to 'forest'
      setThemeState('forest');
    }
    const storedPreset = (localStorage.getItem(PRESET_STORAGE_KEY) as PresetName | null);
    if (storedPreset === 'material' || storedPreset === 'simple' || storedPreset === 'modern') {
      setPresetState(storedPreset);
    }
  }, []);

  // Apply to DOM and persist
  useEffect(() => {
    const root = document.documentElement; // <html>
    // theme attribute
    if (theme === 'light') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    // preset attribute
    root.setAttribute('data-preset', preset);

    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(PRESET_STORAGE_KEY, preset);
  }, [theme, preset]);

  const setTheme = (t: ThemeName) => setThemeState(t);
  const setPreset = (p: PresetName) => setPresetState(p);

  const value = useMemo(() => ({ theme, setTheme, preset, setPreset }), [theme, preset]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme yalnızca ThemeProvider içinde kullanılmalıdır');
  return ctx;
};
