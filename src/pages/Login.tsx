// src/pages/Login.tsx
import React from 'react';
import LoginForm from '../components/LoginForm';
import './Login.css';
import logo from '/images/logo.png';
import PageTransition from '../components/PageTransition';

const Login: React.FC = () => {
  return (
    <PageTransition className="login-page min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Spor Salonu Logo" className="h-24 object-contain drop-shadow-lg" />
        </div>
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/50">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Hoş Geldiniz</h2>
          <LoginForm redirectTo="/" adminOnly />
        </div>
        <p className="text-center text-gray-400 text-xs mt-8">
          &copy; {new Date().getFullYear()} Gym App. Tüm hakları saklıdır.
        </p>
      </div>
    </PageTransition>
  );
};

export default Login;
