// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './utils/AuthContext.tsx';
import { LoginPage as Login } from './design-system/pages/LoginPage';
import BottomNavBar from './components/BottomNavBar.tsx';
import { ToastProvider } from './components/ToastContext';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import Unauthorized from './pages/Unauthorized.tsx';
import MemberLogin from './pages/MemberLogin.tsx';
import LoadingSpinner from './components/LoadingSpinner.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Lazy load heavy components
// Lazy load heavy components
const AdminDashboard = lazy(() => import('./design-system/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const MemberManagement = lazy(() => import('./design-system/pages/MembersPage').then(module => ({ default: module.MembersPage })));
const PackageManagement = lazy(() => import('./design-system/pages/PackagesPage/PackagesPage').then(module => ({ default: module.PackagesPage })));
const BranchManagement = lazy(() => import('./pages/BranchManagement.tsx'));
const CalendarPage = lazy(() => import('./design-system/pages/CalendarPage').then(module => ({ default: module.CalendarPage })));
const Appointments = lazy(() => import('./pages/Appointments.tsx'));
const Reports = lazy(() => import('./design-system/pages/ReportsPage/ReportsPage').then(module => ({ default: module.ReportsPage })));
const MemberDashboard = lazy(() => import('./pages/MemberDashboard.tsx'));

function App() {
  const { currentUser, userRole, loading } = useAuth();

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
                    <CalendarPage />
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
