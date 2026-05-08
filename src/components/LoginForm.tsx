// src/components/LoginForm.tsx
import React, { useState } from 'react';
import { auth, analytics } from '../firebaseConfig'; // Firebase auth ve analytics import et
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'; // Giriş fonksiyonlarını ve Google Auth sağlayıcısını import et
import { logEvent } from 'firebase/analytics';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const navigate = useNavigate();

  const translateAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code;
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

  /**
   * After login, check custom claims to determine if user is admin.
   * Returns true if the user has the admin claim.
   */
  const checkAdminClaim = async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    const idTokenResult = await user.getIdTokenResult(/* forceRefresh */ true);
    return idTokenResult.claims.admin === true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil && Date.now() < lockedUntil) {
      const remainingSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`Çok fazla başarısız deneme. Lütfen ${remainingSeconds} saniye bekleyin.`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      // If adminOnly page, verify admin claim
      if (adminOnly) {
        const isAdmin = await checkAdminClaim();
        if (!isAdmin) {
          await auth.signOut();
          setError('Bu sayfa sadece yönetici girişi içindir. Üye girişi için lütfen /portal sayfasını kullanın.');
          return;
        }
      }

      navigate(redirectTo);
      setLoginAttempts(0); // Reset attempts on success
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Giriş hatası:', error);
      
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      try {
        if (analytics) {
          logEvent(analytics, 'login_failed', { email, attempts: newAttempts, error: (error as any)?.code });
        }
      } catch (e) { /* ignore */ }

      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 30 * 1000); // Lock for 30 seconds
        setError('Çok fazla başarısız deneme. Lütfen 30 saniye bekleyin.');
      } else {
        setError(translateAuthError(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      // If adminOnly page, verify admin claim
      if (adminOnly) {
        const isAdmin = await checkAdminClaim();
        if (!isAdmin) {
          await auth.signOut();
          setError('Bu sayfa sadece yönetici girişi içindir. Üye girişi için lütfen /portal sayfasını kullanın.');
          return;
        }
      }

      navigate(redirectTo);
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Google ile giriş hatası:', error);
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
            <p role="alert" aria-live="polite" style={{ color: 'var(--color-error)', marginBottom: '1rem', fontSize: '14px' }}>
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={loading}
            disabled={lockedUntil !== null && Date.now() < lockedUntil}
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