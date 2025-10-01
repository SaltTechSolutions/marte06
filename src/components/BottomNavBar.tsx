// src/components/BottomNavBar.tsx
import React, { useState } from 'react'; // useState hook'unu import et
import { Link, useNavigate } from 'react-router-dom';
import './BottomNavBar.css';
import { AiOutlineUsergroupAdd } from 'react-icons/ai';
import { MdInventory, MdCalendarMonth, MdBarChart, MdLogout, MdSchedule } from 'react-icons/md';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import ConfirmModal from './ConfirmModal'; // ConfirmModal bileşenini import et
import { useToast } from './ToastContext';

const BottomNavBar: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [showLogoutModal, setShowLogoutModal] = useState(false); // Modal görünürlük state'i

  // Çıkış yapma işlemini başlatan fonksiyon (modali açar)
  const handleLogoutClick = () => {
    setShowLogoutModal(true); // Modali göster
  };

  // Modal üzerinde evet tıklandığında çıkış işlemini yapan fonksiyon
  const handleConfirmLogout = async () => {
    setShowLogoutModal(false); // Modali kapat
    try {
      await signOut(auth);
      console.log('Çıkış başarılı!');
      navigate('/login');
    } catch (error: any) {
      console.error('Çıkış hatası:', error.message);
      showError('Çıkış yapılırken bir hata oluştu: ' + error.message);
    }
  };

  // Modal üzerinde hayır tıklandığında veya kapatıldığında modali kapatan fonksiyon
  const handleCancelLogout = () => {
    setShowLogoutModal(false); // Modali kapat
  };

  // Aktif sekmeyi belirle (path'e göre)
  const currentPath = window.location.pathname;
  const navItems = [
    { to: '/members', icon: <AiOutlineUsergroupAdd size={24} />, label: 'Üyeler', tooltip: 'Üye Yönetimi', aria: 'Üyeler Sayfası' },
    { to: '/packages', icon: <MdInventory size={24} />, label: 'Paketler', tooltip: 'Paket Yönetimi', aria: 'Paketler Sayfası' },
    { to: '/calendar', icon: <MdCalendarMonth size={24} />, label: 'Takvim', tooltip: 'Takvim', aria: 'Takvim Sayfası' },
    { to: '/appointments', icon: <MdSchedule size={24} />, label: 'Randevular', tooltip: 'Randevular', aria: 'Randevular Sayfası' },
    { to: '/reports', icon: <MdBarChart size={24} />, label: 'Raporlar', tooltip: 'Raporlar', aria: 'Raporlar Sayfası' },
  ];

  return (
    <>
      <nav className="bottom-nav-bar" role="navigation" aria-label="Alt Navigasyon Barı">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-link${currentPath.startsWith(item.to) ? ' active' : ''}`}
            tabIndex={0}
            aria-current={currentPath.startsWith(item.to) ? 'page' : undefined}
            aria-label={item.aria}
            title={item.tooltip}
          >
            {React.cloneElement(item.icon, { size: 24, style: { display: 'block', flexShrink: 0 } })}
          </Link>
        ))}
        {/* Çıkış Yap butonu - Modali açar */}
        <button
          onClick={handleLogoutClick}
          className="nav-link logout-link-button"
          tabIndex={0}
          aria-label="Çıkış Yap"
          title="Çıkış Yap"
        >
          <MdLogout size={24} style={{ display: 'block', flexShrink: 0 }} />
        </button>
      </nav>

      {/* Onay Modali */}
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
