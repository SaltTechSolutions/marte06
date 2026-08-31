import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useThemeMode } from '../../../utils/ThemeContext';
import './ThemeToggle.css';

export const ThemeToggle: React.FC = () => {
  const { mode, toggleMode } = useThemeMode();

  return (
    <button
      onClick={toggleMode}
      className="theme-toggle-btn"
      aria-label={mode === 'dark' ? 'Açık Moda Geç' : 'Karanlık Moda Geç'}
      title={mode === 'dark' ? 'Açık Moda Geç' : 'Karanlık Moda Geç'}
    >
      <div className="theme-toggle-icon-wrapper">
        {mode === 'dark' ? (
          <FiSun className="theme-toggle-icon sun-icon animate-bounce-subtle" />
        ) : (
          <FiMoon className="theme-toggle-icon moon-icon animate-bounce-subtle" />
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;
