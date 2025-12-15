// src/components/LoginForm.tsx
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth objesini import et
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'; // Giriş fonksiyonlarını ve Google Auth sağlayıcısını import et
import { useNavigate } from 'react-router-dom';
import googleLogo from '../images/google-logo.png'; // Google logosunu import et
import { MdMailOutline } from 'react-icons/md';
import { TextField, Button } from '../newUI/primitives'; // UI Primitives import

interface LoginFormProps {
  redirectTo?: string;
  enableGoogle?: boolean;
  adminOnly?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ redirectTo = '/members', enableGoogle = true, adminOnly = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); // Hata mesajı için state
  const [loading, setLoading] = useState(false); // Loading state'i eklendi
  const navigate = useNavigate();

  // Admin e-posta listesi (AuthContext ile aynı olmalı)
  const adminEmails = ['tarabyamarte@gmail.com', 'tarkan.cicek@gmail.com'];

  const translateAuthError = (err: any): string => {
    const code = err?.code as string | undefined;
    switch (code) {
      case 'auth/invalid-email':
        return 'Geçersiz e-posta adresi.';
      case 'auth/user-disabled':
        return 'Bu kullanıcı hesabı devre dışı bırakılmış.';
      case 'auth/user-not-found':
        return 'Kullanıcı bulunamadı.';
      case 'auth/wrong-password':
        return 'Hatalı şifre.';
      case 'auth/popup-closed-by-user':
        return 'Giriş penceresi kullanıcı tarafından kapatıldı.';
      case 'auth/cancelled-popup-request':
        return 'Açılan pencere isteği iptal edildi.';
      case 'auth/popup-blocked':
        return 'Açılır pencere engellendi.';
      case 'auth/too-many-requests':
        return 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.';
      case 'auth/network-request-failed':
        return 'Ağ hatası. İnternet bağlantınızı kontrol edin.';
      default:
        return 'Giriş sırasında bir hata oluştu.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Önceki hataları temizle
    setLoading(true); // Giriş yapılırken loading true yap

    try {
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (adminOnly && !adminEmails.includes(normalizedEmail)) {
        setError('Bu sayfa sadece yönetici girişi içindir. Üye girişi için lütfen /portal sayfasını kullanın.');
        return;
      }
      // Firebase Authentication ile giriş yap
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Giriş başarılı:', userCredential.user);
      if (adminOnly) {
        const signedEmail = (userCredential.user.email || '').toLowerCase();
        if (!adminEmails.includes(signedEmail)) {
          await signOut(auth);
          setError('Bu sayfa sadece yönetici girişi içindir. Üye girişi için lütfen /portal sayfasını kullanın.');
          return;
        }
      }
      navigate(redirectTo);
    } catch (error: any) {
      console.error('Giriş hatası:', error.message);
      setError(translateAuthError(error)); // Hata mesajını Türkçeye çevir
    } finally {
      setLoading(false); // İşlem bitince (başarılı veya hatalı) loading false yap
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('Google ile giriş başarılı:', result.user);
      const signedEmail = (result.user.email || '').toLowerCase();
      if (adminOnly && !adminEmails.includes(signedEmail)) {
        await signOut(auth);
        setError('Bu sayfa sadece yönetici girişi içindir. Üye girişi için lütfen /portal sayfasını kullanın.');
        return;
      }
      navigate(redirectTo);
    } catch (error: any) {
      console.error('Google ile giriş hatası:', error.message);
      setError(translateAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <form onSubmit={handleSubmit} aria-label="Giriş Formu">
          <TextField
            id="email"
            type="email"
            label="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mb-4"
          />
          
          <TextField
            id="password"
            type="password"
            label="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mb-6"
          />

          {error && (
            <p role="alert" aria-live="polite" style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={loading}
            fullWidth
            variant="primary"
            tone="solid"
            className="mb-3"
            icon={<MdMailOutline size={18} />}
          >
            Giriş Yap
          </Button>

          {enableGoogle && (
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              fullWidth
              variant="neutral"
              tone="outline"
            >
              <img src={googleLogo} alt="Google logosu" className="google-btn-icon" style={{ width: 18, height: 18, marginRight: 8 }} />
              Google ile Giriş Yap
            </Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginForm;