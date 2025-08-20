import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ToastProvider } from '../components/ToastContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../utils/AuthContext';

// Reuse existing pages for now; we will refactor feature by feature
import Login from '../pages/Login';
import MemberManagement from '../pages/MemberManagement';
import PackageManagement from '../pages/PackageManagement';
import BranchManagement from '../pages/BranchManagement';
import CalendarManagement from '../pages/CalendarManagement';
import Reports from '../pages/Reports';
import Unauthorized from '../pages/Unauthorized';
import Appointments from '../pages/Appointments';
import { FiUsers, FiPackage, FiClock, FiCalendar, FiBarChart2, FiSettings } from 'react-icons/fi';
import Settings from '../pages/Settings';


function BottomNav() {
  const items = [
    { to: '/members', label: 'Üyeler', icon: <FiUsers /> },
    { to: '/packages', label: 'Paketler', icon: <FiPackage /> },
    { to: '/appointments', label: 'Randevular', icon: <FiClock /> },
    { to: '/calendar', label: 'Takvim', icon: <FiCalendar /> },
    { to: '/reports', label: 'Rapor', icon: <FiBarChart2 /> },
    { to: '/settings', label: 'Ayarlar', icon: <FiSettings /> },
  ];
  const nav = (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[120] backdrop-blur border-t border-border"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 120,
        background: 'var(--nav-bg)',
        backdropFilter: 'saturate(180%) blur(8px)',
        borderTop: '1px solid var(--color-border)'
      }}
    >
      <div
        className="mx-auto max-w-screen-md grid grid-cols-6 h-14 pb-[env(safe-area-inset-bottom)]"
        style={{
          maxWidth: '768px',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          height: '56px',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-xs gap-1 ${
                isActive ? 'text-primary' : 'text-[var(--nav-text)]'
              }`
            }
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
            }}
          >
            <span className="text-xl">{it.icon}</span>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
  return createPortal(nav, document.body);
}

export default function App() {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted-color)]">Yükleniyor...</div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg text-[var(--text-color)]">
        <main
          className="mx-auto max-w-screen-md px-3 pt-3 pb-[calc(56px+env(safe-area-inset-bottom))]"
          style={{
            maxWidth: '768px',
            paddingLeft: '12px',
            paddingRight: '12px',
            paddingTop: '12px',
            paddingBottom: 'calc(56px + env(safe-area-inset-bottom))'
          }}
        >
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
        </main>
        {currentUser && userRole === 'admin' && <BottomNav />}
      </div>
    </ToastProvider>
  );
}
