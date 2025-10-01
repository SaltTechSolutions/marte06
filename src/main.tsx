import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // Import the new index.css
import App from './App.tsx'
import { AuthProvider } from './utils/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeContext';

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
