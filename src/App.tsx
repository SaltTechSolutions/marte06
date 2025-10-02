// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useMemo } from 'react';
import { useAuth } from './utils/AuthContext.tsx';
import Login from './pages/Login.tsx';
import BottomNavBar from './components/BottomNavBar.tsx';
import { ToastProvider } from './components/ToastContext';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import Unauthorized from './pages/Unauthorized.tsx';
import MemberLogin from './pages/MemberLogin.tsx';
import LoadingSpinner from './components/LoadingSpinner.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Lazy load heavy components
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.tsx'));
const MemberManagement = lazy(() => import('./pages/MemberManagement.tsx'));
const PackageManagement = lazy(() => import('./pages/PackageManagement.tsx'));
const BranchManagement = lazy(() => import('./pages/BranchManagement.tsx'));
const CalendarManagement = lazy(() => import('./pages/CalendarManagement.tsx'));
const Appointments = lazy(() => import('./pages/Appointments.tsx'));
const Reports = lazy(() => import('./pages/Reports.tsx'));
const MemberDashboard = lazy(() => import('./pages/MemberDashboard.tsx'));
const NewCalendarPage = lazy(() => import('./newUI/pages/CalendarPage.tsx'));

function App() {
  const { currentUser, userRole, loading } = useAuth();

  const useNewCalendarUI = useMemo(() => {
    const envFlag = import.meta.env.VITE_USE_NEW_CALENDAR;
    if (envFlag === 'true') return true;
    if (envFlag === 'false') return false;
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('useNewCalendar');
    return stored === 'true';
  }, []);

  // Debug logging
  console.log('[App] Auth state:', { loading, userRole, hasUser: !!currentUser });

  if (loading) {
    return <LoadingSpinner fullScreen message="Yükleniyor..." />;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="App">
          <Suspense fallback={<LoadingSpinner fullScreen message="Sayfa yükleniyor..." />}>
            <Routes>
          {/* Admin Login (sadece admin için). Kullanıcı giriş yaptıysa yönlendir. */}
          <Route
            path="/login"
            element={
              currentUser
                ? (userRole === 'admin' ? <Navigate to="/dashboard" /> : <Navigate to="/portal" />)
                : <Login />
            }
          />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Üye Portal: /portal sayfasında login + dashboard */}
          <Route path="/portal/login" element={<Navigate to="/portal" replace />} />
          <Route
            path="/portal"
            element={
              loading ? (
                <div>Yükleniyor...</div>
              ) : currentUser ? (
                userRole === 'member' ? (
                  <MemberDashboard />
                ) : userRole === 'admin' ? (
                  <Navigate to="/members" />
                ) : (
                  // Giriş yapılı ama rol çözülmedi -> üye portalında kal ve login/info göster
                  <MemberLogin />
                )
              ) : (
                <MemberLogin />
              )
            }
          />

          {/* Admin Rotaları */}
          <Route path="/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><MemberManagement /></ProtectedRoute>} />
          <Route path="/packages" element={<ProtectedRoute><PackageManagement /></ProtectedRoute>} />
          <Route path="/branches" element={<ProtectedRoute><BranchManagement /></ProtectedRoute>} />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                {useNewCalendarUI ? <NewCalendarPage /> : <CalendarManagement />}
              </ProtectedRoute>
            }
          />
          <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

          {/* Ana Rota Yönlendirmesi */}
          <Route
            path="/"
            element={
              !currentUser ? (
                <Navigate to="/login" />
              ) : userRole === 'admin' ? (
                <Navigate to="/dashboard" />
              ) : userRole === 'member' ? (
                <Navigate to="/portal" />
              ) : (
                <Navigate to="/unauthorized" />
              )
            }
          />

          {/* Tanımlanmayan rotalar için */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>

        {currentUser && userRole === 'admin' && <BottomNavBar />}
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
