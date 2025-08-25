// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext.tsx';
import Login from './pages/Login.tsx';
import MemberManagement from './pages/MemberManagement.tsx';
import PackageManagement from './pages/PackageManagement.tsx';
import BranchManagement from './pages/BranchManagement.tsx';
import CalendarManagement from './pages/CalendarManagement.tsx';
import Appointments from './pages/Appointments.tsx';
import Reports from './pages/Reports.tsx';
import BottomNavBar from './components/BottomNavBar.tsx';
import { ToastProvider } from './components/ToastContext';
import ProtectedRoute from './components/ProtectedRoute.tsx'; // Korunmuş rota bileşeni
import Unauthorized from './pages/Unauthorized.tsx'; // Yetkisiz erişim sayfası
import MemberLogin from './pages/MemberLogin.tsx';
import MemberDashboard from './pages/MemberDashboard.tsx';
// import MemberRoute from './components/MemberRoute.tsx';

function App() {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <ToastProvider>
      <div className="App">
        <Routes>
          {/* Admin Login (sadece admin için). Kullanıcı giriş yaptıysa yönlendir. */}
          <Route
            path="/login"
            element={
              currentUser
                ? (userRole === 'admin' ? <Navigate to="/members" /> : <Navigate to="/portal" />)
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
          <Route path="/members" element={<ProtectedRoute><MemberManagement /></ProtectedRoute>} />
          <Route path="/packages" element={<ProtectedRoute><PackageManagement /></ProtectedRoute>} />
          <Route path="/branches" element={<ProtectedRoute><BranchManagement /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarManagement /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

          {/* Ana Rota Yönlendirmesi */}
          <Route
            path="/"
            element={
              !currentUser ? (
                <Navigate to="/login" />
              ) : userRole === 'admin' ? (
                <Navigate to="/members" />
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

        {currentUser && userRole === 'admin' && <BottomNavBar />}
      </div>
    </ToastProvider>
  );
}

export default App;
