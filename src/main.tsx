import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // Import the legacy index.css
import './design-system/index.css' // Import the new Design System CSS
import App from './App.tsx'
import { AuthProvider } from './utils/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './utils/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
