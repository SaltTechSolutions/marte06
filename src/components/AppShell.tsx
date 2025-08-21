// src/components/AppShell.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FiUsers, FiPackage, FiClock, FiCalendar, FiBarChart2, FiSettings } from 'react-icons/fi';
import './AppShell.css';

interface AppShellProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

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
    <nav className="app-bottom-nav">
      <div className="nav-grid">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            aria-label={it.label}
          >
            <span className="nav-icon">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
  return createPortal(nav, document.body);
}

export default function AppShell({ children, showBottomNav }: AppShellProps) {
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-container header-inner">
          <div className="brand">Marte</div>
          <div className="spacer" />
        </div>
      </header>

      <main className="app-main">
        <div className="app-container">
          {children}
        </div>
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
}
