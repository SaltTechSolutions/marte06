// src/utils/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth objesini import et
import type { User } from 'firebase/auth'; // Firebase User tipini import et, type-only import yapıldı

export type UserRole = 'admin' | null; // Rolleri tanımla, null yetkisiz demek

interface AuthContextType {
  currentUser: User | null;
  userRole: UserRole;
  loading: boolean; // Kimlik doğrulama ve rol yüklenme durumunu kontrol eder
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const events = ['load', 'mousemove', 'mousedown', 'click', 'scroll', 'keypress'];

    const resetTimer = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const checkTimeout = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      const timeout = 2 * 60 * 60 * 1000; // 2 saat

      if (lastActivity && Date.now() - parseInt(lastActivity, 10) > timeout) {
        auth.signOut().then(() => {
          localStorage.removeItem('lastActivity');
        });
      }
    };

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        // Rol belirleme
        const adminEmails = ['tarabyamarte@gmail.com', 'tarkan.cicek@gmail.com'];
        if (user.email && adminEmails.includes(user.email)) {
          setUserRole('admin');
        } else {
          setUserRole(null);
        }

        // Aktivite takibini başlat
        resetTimer();
        for (const event of events) {
          window.addEventListener(event, resetTimer);
        }
        const intervalId = setInterval(checkTimeout, 60000); // Her dakika kontrol et

        // Cleanup for interval
        (window as any).activityIntervalId = intervalId;

      } else {
        setUserRole(null);
        // Aktivite takibini durdur
        for (const event of events) {
          window.removeEventListener(event, resetTimer);
        }
        if ((window as any).activityIntervalId) {
          clearInterval((window as any).activityIntervalId);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Component unmount olduğunda da temizle
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
      if ((window as any).activityIntervalId) {
        clearInterval((window as any).activityIntervalId);
      }
    };
  }, []);

  const value = { currentUser, userRole, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
