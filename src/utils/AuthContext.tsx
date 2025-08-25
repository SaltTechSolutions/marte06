// src/utils/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth objesini import et
import type { User } from 'firebase/auth'; // Firebase User tipini import et, type-only import yapıldı
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

export type UserRole = 'admin' | 'member' | null; // Rolleri tanımla, null yetkisiz demek

interface AuthContextType {
  currentUser: User | null;
  userRole: UserRole;
  loading: boolean; // Kimlik doğrulama ve rol yüklenme durumunu kontrol eder
  memberId: string | null; // Üye portalı için giriş yapan kullanıcının members doc id'si
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
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
          setMemberId(null);
        } else {
          // Üye mi? Önce UID ile ara (tercih edilen), bulunamazsa email ile dene.
          try {
            const uid = user.uid;
            const email = (user.email || '').trim().toLowerCase();
            let foundMemberId: string | null = null;
            console.log('[Auth] Signed in user -> uid:', uid, 'email:', email);

            // 1) UID bazlı arama (tercih edilen ve güvenli)
            if (uid) {
              try {
                const qUid = query(collection(db, 'members'), where('memberUid', '==', uid));
                const snapUid = await getDocs(qUid);
                console.log('[Auth] UID query size:', snapUid.size);
                if (!snapUid.empty) {
                  foundMemberId = snapUid.docs[0].id;
                }
              } catch (err) {
                console.warn('UID ile üye arama hatası:', err);
              }
            }

            // 2) Fallback: email bazlı arama
            if (!foundMemberId && email) {
              try {
                const qEmail = query(collection(db, 'members'), where('email', '==', email));
                const snapEmail = await getDocs(qEmail);
                console.log('[Auth] Email query size:', snapEmail.size);
                if (!snapEmail.empty) {
                  foundMemberId = snapEmail.docs[0].id;
                }
              } catch (err) {
                console.warn('Email ile üye arama hatası:', err);
              }
            }

            if (foundMemberId) {
              console.log('[Auth] Member doc found:', foundMemberId);
              setUserRole('member');
              setMemberId(foundMemberId);
            } else {
              console.warn('[Auth] Member doc NOT found for uid/email. Role will be null.');
              setUserRole(null);
              setMemberId(null);
            }
          } catch (e) {
            console.error('Üye rolü belirlenirken hata:', e);
            setUserRole(null);
            setMemberId(null);
          }
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
        setMemberId(null);
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

  const value = { currentUser, userRole, loading, memberId };

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
