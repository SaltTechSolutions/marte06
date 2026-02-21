// src/components/BottomNavBar.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AiOutlineUsergroupAdd } from 'react-icons/ai';
import { MdInventory, MdCalendarMonth, MdBarChart, MdLogout, MdDashboard, MdSettings } from 'react-icons/md';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import ConfirmModal from './ConfirmModal';
import { useToast } from './ToastContext';
import { motion } from 'framer-motion';

// react-router-dom bellek sızıntıları veya uyumsuzluklar oluşturmaması adına Link'i sarmalıyoruz
const MotionLink = motion.create ? motion.create(Link) : motion(Link as any);

const BottomNavBar: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await signOut(auth);
      console.log('Çıkış başarılı!');
      navigate('/login');
    } catch (error: any) {
      console.error('Çıkış hatası:', error.message);
      showError('Çıkış yapılırken bir hata oluştu: ' + error.message);
    }
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };

  const currentPath = window.location.pathname;
  const navItems = [
    { to: '/dashboard', icon: <MdDashboard size={24} />, label: 'Dashboard', tooltip: 'Dashboard', aria: 'Dashboard Sayfası' },
    { to: '/members', icon: <AiOutlineUsergroupAdd size={24} />, label: 'Üyeler', tooltip: 'Üye Yönetimi', aria: 'Üyeler Sayfası' },
    { to: '/calendar', icon: <MdCalendarMonth size={24} />, label: 'Takvim', tooltip: 'Takvim', aria: 'Takvim Sayfası' },
    { to: '/packages', icon: <MdInventory size={24} />, label: 'Paketler', tooltip: 'Paket Yönetimi', aria: 'Paketler Sayfası' },
    { to: '/reports', icon: <MdBarChart size={24} />, label: 'Raporlar', tooltip: 'Raporlar', aria: 'Raporlar Sayfası' },
    { to: '/settings', icon: <MdSettings size={24} />, label: 'Ayarlar', tooltip: 'Ayarlar', aria: 'Ayarlar Sayfası' },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 w-full h-[calc(70px+env(safe-area-inset-bottom))] bg-[rgba(27,76,125,0.9)] backdrop-blur-md border-t border-white/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-start pt-3 pb-[env(safe-area-inset-bottom)] z-[1000] transition-transform duration-300 ease-in-out"
        role="navigation"
        aria-label="Alt Navigasyon Barı"
      >
        {navItems.map((item) => {
          const isActive = currentPath.startsWith(item.to);
          return (
            <MotionLink
              key={item.to}
              to={item.to}
              whileTap={{ scale: 0.90 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={`flex flex-col items-center justify-center no-underline text-xs font-medium gap-1 p-2 rounded-xl transition-colors duration-200 ease-in-out relative min-w-[64px] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-primary-soft)] ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-light)]'}`}
              tabIndex={0}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.aria}
              title={item.tooltip}
              style={{ paddingBottom: '8px' }}
            >
              <div className={`transition-transform duration-200 ease-in-out ${isActive ? '-translate-y-0.5 drop-shadow-[0_4px_6px_rgba(79,70,229,0.3)]' : ''}`}>
                {React.cloneElement(item.icon, { size: 24, style: { display: 'block', flexShrink: 0 } })}
              </div>
            </MotionLink>
          );
        })}
        {/* Çıkış Yap butonu */}
        <motion.button
          onClick={handleLogoutClick}
          whileTap={{ scale: 0.90 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="flex flex-col items-center justify-center bg-transparent border-none cursor-pointer text-[var(--color-text-light)] text-xs font-medium gap-1 p-2 rounded-xl transition-colors duration-200 ease-in-out relative min-w-[64px] hover:text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.1)]"
          tabIndex={0}
          aria-label="Çıkış Yap"
          title="Çıkış Yap"
          style={{ paddingBottom: '8px' }}
        >
          <MdLogout size={24} style={{ display: 'block', flexShrink: 0 }} />
        </motion.button>
      </nav>

      <ConfirmModal
        message="Çıkış yapmak istediğinizden emin misiniz?"
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
        isVisible={showLogoutModal}
      />
    </>
  );
};

export default BottomNavBar;
