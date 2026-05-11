// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useAuth } from './utils/AuthContext.tsx';
import { LoginPage as Login } from './design-system/pages/LoginPage';
import BottomNavBar from './components/BottomNavBar.tsx';
import { ToastProvider } from './components/ToastContext';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import LoadingSpinner from './components/LoadingSpinner.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Unauthorized from './pages/Unauthorized.tsx';

// Lazy load heavy components
const AdminDashboard = lazy(() => import('./design-system/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const MemberManagement = lazy(() => import('./design-system/pages/MembersPage').then(module => ({ default: module.MembersPage })));
const PackageManagement = lazy(() => import('./design-system/pages/PackagesPage/PackagesPage').then(module => ({ default: module.PackagesPage })));
const BranchManagement = lazy(() => import('./pages/BranchManagement.tsx'));
const CalendarPage = lazy(() => import('./design-system/pages/CalendarPage').then(module => ({ default: module.CalendarPage })));
const Appointments = lazy(() => import('./pages/Appointments.tsx'));
const Reports = lazy(() => import('./design-system/pages/ReportsPage/ReportsPage').then(module => ({ default: module.ReportsPage })));
const MemberDashboard = lazy(() => import('./pages/MemberDashboard.tsx'));
const Settings = lazy(() => import('./pages/Settings.tsx'));
const UXPreviewPage = lazy(() => import('./ux-preview/UXPreviewPage'));

function App() {
  const { currentUser, userRole, loading, logout } = useAuth();
  const location = useLocation();
  const forceLogin = useMemo(() => new URLSearchParams(location.search).get('force') === '1', [location.search]);

  useEffect(() => {
    if (forceLogin && currentUser) {
      logout();
    }
  }, [currentUser, forceLogin, logout]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Yükleniyor..." />;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="App">
          <Suspense fallback={<LoadingSpinner fullScreen message="Sayfa yükleniyor..." />}>
            <Routes>
              <Route path="/ux-preview" element={<UXPreviewPage />} />
              {/* Admin Login (sadece admin için). Kullanıcı giriş yaptıysa yönlendir. */}
              <Route
                path="/login"
                element={
                  forceLogin
                    ? <Login adminOnly={false} />
                    : currentUser
                    ? (userRole === 'admin' ? <Navigate to="/dashboard" /> : userRole === 'member' ? <Navigate to="/member" /> : <Navigate to="/unauthorized" />)
                    : <Login adminOnly={false} />
                }
              />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Legacy portal routes now resolve through the single login/member flow. */}
              <Route path="/portal/login" element={<Navigate to="/login" replace />} />
              <Route
                path="/portal"
                element={<Navigate to={currentUser ? (userRole === 'admin' ? '/dashboard' : '/member') : '/login'} replace />}
              />
              <Route
                path="/member"
                element={
                  loading ? (
                    <div>Yükleniyor...</div>
                  ) : currentUser ? (
                    userRole === 'member' ? (
                      <MemberDashboard />
                    ) : userRole === 'admin' ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to="/unauthorized" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
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
                    <CalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* Ana Rota Yönlendirmesi */}
              <Route
                path="/"
                element={
                  !currentUser ? (
                    <Navigate to="/login" />
                  ) : userRole === 'admin' ? (
                    <Navigate to="/dashboard" />
                  ) : userRole === 'member' ? (
                    <Navigate to="/member" />
                  ) : (
                    <Navigate to="/login" />
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
