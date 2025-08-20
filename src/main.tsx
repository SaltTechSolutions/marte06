import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // Import the new index.css
import LegacyApp from './App.tsx'
import NewApp from './newui/App.tsx'
import { AuthProvider } from './utils/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeContext';

const useNewUI = (import.meta.env.VITE_NEW_UI ?? '1') !== '0';
const AppComponent = useNewUI ? NewApp : LegacyApp;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AppComponent />
        </ThemeProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
