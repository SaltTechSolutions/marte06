// src/components/MemberRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

interface MemberRouteProps {
  children: React.ReactElement;
}

const MemberRoute: React.FC<MemberRouteProps> = ({ children }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div>Yükleniyor...</div>;

  if (!currentUser) {
    return <Navigate to="/portal" replace />;
  }
  if (userRole !== 'member') {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default MemberRoute;
