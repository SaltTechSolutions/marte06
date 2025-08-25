// src/pages/MemberLogin.tsx
import React from 'react';
import LoginForm from '../components/LoginForm';
import './Login.css';
import logo from '/images/logo.png';

const MemberLogin: React.FC = () => {
  return (
    <div className="login-page">
      <img src={logo} alt="Tarabya Marte Logo" className="login-logo" />
      <LoginForm redirectTo="/portal" enableGoogle={false} />
    </div>
  );
};

export default MemberLogin;
