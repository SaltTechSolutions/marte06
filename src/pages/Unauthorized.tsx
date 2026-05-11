// src/pages/Unauthorized.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

const Unauthorized: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-800">Yetkisiz Erişim</h1>
        <p className="text-gray-600 mt-2">
          Bu sayfaya erişmek için gerekli yetkilere sahip değilsiniz. Lütfen ana sayfaya dönün veya giriş yapın.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/"
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Ana sayfa
          </Link>
          {currentUser ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-4 py-2 rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-60"
            >
              {loggingOut ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
            </button>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-md bg-primary text-white hover:opacity-90"
            >
              Giriş Yap
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
