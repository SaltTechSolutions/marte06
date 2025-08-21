import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ToastContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../utils/AuthContext';
import AppShell from '../components/AppShell';

// Reuse existing pages for now; we will refactor feature by feature
import Login from '../pages/Login';
import MemberManagement from '../pages/MemberManagement';
import PackageManagement from '../pages/PackageManagement';
import BranchManagement from '../pages/BranchManagement';
import CalendarManagement from '../pages/CalendarManagement';
import Reports from '../pages/Reports';
import Unauthorized from '../pages/Unauthorized';
import Appointments from '../pages/Appointments';
import Settings from '../pages/Settings';


export default function App() {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted-color)]">Yükleniyor...</div>
    );
  }

  return (
    <ToastProvider>
      <AppShell showBottomNav={Boolean(currentUser && userRole === 'admin')}>
        <Routes>
          <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Admin routes */}
          <Route path="/members" element={<ProtectedRoute><MemberManagement /></ProtectedRoute>} />
          <Route path="/packages" element={<ProtectedRoute><PackageManagement /></ProtectedRoute>} />
          <Route path="/branches" element={<ProtectedRoute><BranchManagement /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarManagement /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route
            path="/"
            element={!currentUser ? (
              <Navigate to="/login" />
            ) : userRole === 'admin' ? (
              <Navigate to="/members" />
            ) : (
              <Navigate to="/unauthorized" />
            )}
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppShell>
    </ToastProvider>
  );
}
