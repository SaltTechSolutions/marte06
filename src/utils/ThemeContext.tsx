import React, { useEffect } from 'react';
import {
  applyCSSTokens,
  createPreset,
  themes,
  toCSSVariables,
} from '../theme/designSystem';

const LIGHT_THEME_ID = 'mint';
const LIGHT_CORNERS = 'soft';
const LIGHT_DENSITY = 'comfortable';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const variables = toCSSVariables(
      themes[LIGHT_THEME_ID],
      createPreset(LIGHT_DENSITY, LIGHT_CORNERS),
    );
    applyCSSTokens(variables);

    const root = document.documentElement;
    root.style.colorScheme = 'light';
    root.setAttribute('data-brand', LIGHT_THEME_ID);
    root.setAttribute('data-corners', LIGHT_CORNERS);
    root.setAttribute('data-density', LIGHT_DENSITY);
    root.setAttribute('data-theme', 'light');

    localStorage.removeItem('theme');
    localStorage.removeItem('ui.theme.id');
    localStorage.removeItem('ui.theme.corners');
    localStorage.removeItem('ui.theme.density');
  }, []);

  return <>{children}</>;
};
