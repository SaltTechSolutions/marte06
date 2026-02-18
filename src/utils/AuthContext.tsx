// src/utils/AuthContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { auth } from '../firebaseConfig';
import type { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ADMIN_EMAILS } from '../constants/auth';

export type UserRole = 'admin' | 'member' | null;

interface AuthContextType {
  currentUser: User | null;
  userRole: UserRole;
  loading: boolean;
  memberId: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Use a ref for the interval so cleanup is always correct
  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const events = ['load', 'mousemove', 'mousedown', 'click', 'scroll', 'keypress'] as const;

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

    const startActivityTracking = () => {
      resetTimer();
      for (const event of events) {
        window.addEventListener(event, resetTimer);
      }
      activityIntervalRef.current = setInterval(checkTimeout, 60000);
    };

    const stopActivityTracking = () => {
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
      if (activityIntervalRef.current !== null) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (import.meta.env.DEV) {
        console.log('[Auth] onAuthStateChanged triggered, user:', user?.email || 'null');
      }
      setCurrentUser(user);

      if (user) {
        if (user.email && ADMIN_EMAILS.includes(user.email)) {
          setUserRole('admin');
          setMemberId(null);
        } else {
          try {
            const uid = user.uid;
            const email = (user.email || '').trim().toLowerCase();
            let foundMemberId: string | null = null;

            if (import.meta.env.DEV) {
              console.log('[Auth] Signed in user -> uid:', uid, 'email:', email);
            }

            // 1) UID bazlı arama (tercih edilen)
            if (uid) {
              try {
                const qUid = query(collection(db, 'members'), where('memberUid', '==', uid));
                const snapUid = await getDocs(qUid);
                if (!snapUid.empty) {
                  foundMemberId = snapUid.docs[0].id;
                }
              } catch (err) {
                if (import.meta.env.DEV) console.warn('UID ile üye arama hatası:', err);
              }
            }

            // 2) Fallback: email bazlı arama
            if (!foundMemberId && email) {
              try {
                const qEmail = query(collection(db, 'members'), where('email', '==', email));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) {
                  foundMemberId = snapEmail.docs[0].id;
                }
              } catch (err) {
                if (import.meta.env.DEV) console.warn('Email ile üye arama hatası:', err);
              }
            }

            if (foundMemberId) {
              setUserRole('member');
              setMemberId(foundMemberId);
            } else {
              if (import.meta.env.DEV) {
                console.warn('[Auth] Member doc NOT found for uid/email. Role will be null.');
              }
              setUserRole(null);
              setMemberId(null);
            }
          } catch (e) {
            if (import.meta.env.DEV) console.error('Üye rolü belirlenirken hata:', e);
            setUserRole(null);
            setMemberId(null);
          }
        }

        startActivityTracking();
      } else {
        setUserRole(null);
        setMemberId(null);
        stopActivityTracking();
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
      stopActivityTracking();
    };
  }, []);

  const logout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('lastActivity');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Logout error:', error);
    }
  };

  const value = { currentUser, userRole, loading, memberId, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth yalnızca AuthProvider içinde kullanılmalıdır');
  }
  return context;
};
