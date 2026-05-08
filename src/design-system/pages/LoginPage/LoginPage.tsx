// src/design-system/pages/LoginPage/LoginPage.tsx
// Yeni design system ile modern login sayfası

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { logEvent } from 'firebase/analytics';
import { auth, analytics } from '../../../firebaseConfig';
import { Button, Input, Card } from '../../components';
import { FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import './LoginPage.css';

interface LoginPageProps {
    redirectTo?: string;
    adminOnly?: boolean;
}

/**
 * Check admin custom claim on the currently signed-in user.
 * Forces a token refresh to get the latest claims.
 */
const checkAdminClaim = async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    const idTokenResult = await user.getIdTokenResult(/* forceRefresh */ true);
    return idTokenResult.claims.admin === true;
};

export const LoginPage: React.FC<LoginPageProps> = ({
    redirectTo = '/dashboard',
    adminOnly = true // Admin login varsayılan
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loginAttempts, setLoginAttempts] = useState(0);
    const [lockedUntil, setLockedUntil] = useState<number | null>(null);
    const navigate = useNavigate();

    const translateAuthError = (err: unknown): string => {
        const code = (err as { code?: string })?.code;
        switch (code) {
            case 'auth/invalid-email': return 'Geçersiz e-posta adresi.';
            case 'auth/user-disabled': return 'Bu hesap devre dışı.';
            case 'auth/user-not-found': return 'Kullanıcı bulunamadı.';
            case 'auth/wrong-password': return 'Hatalı şifre.';
            case 'auth/too-many-requests': return 'Çok fazla deneme yapıldı.';
            case 'auth/popup-blocked': return 'Tarayıcı pop-up penceresini engelledi. Lütfen izin verin.';
            case 'auth/popup-closed-by-user': return 'Giriş işlemi iptal edildi.';
            case 'auth/internal-error': return 'Sunucu hatası (Internal Error). Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.';
            default: return 'Giriş yapılamadı.';
        }
    };

    // Redirect sonucunu yakala (Mobil uyumluluğu için)
    React.useEffect(() => {
        const handleRedirectResult = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    // Check admin claim after redirect login
                    if (adminOnly) {
                        const isAdmin = await checkAdminClaim();
                        if (!isAdmin) {
                            await signOut(auth);
                            setError('Yetkisiz erişim. Sadece yöneticiler giriş yapabilir.');
                            return;
                        }
                    }
                    navigate(redirectTo);
                }
            } catch (err: unknown) {
                if (import.meta.env.DEV) console.error('Redirect login error:', err);
                setError(translateAuthError(err));
            }
        };

        handleRedirectResult();
    }, [adminOnly, navigate, redirectTo]);

    const handleLogin = async (e: React.FormEvent) => {
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

            // Check admin claim after successful auth
            if (adminOnly) {
                const isAdmin = await checkAdminClaim();
                if (!isAdmin) {
                    await signOut(auth);
                    setError('Yetkisiz erişim. Sadece yöneticiler giriş yapabilir.');
                    return;
                }
            }

            navigate(redirectTo);
            setLoginAttempts(0); // Reset attempts on success
        } catch (err: unknown) {
            if (import.meta.env.DEV) console.error('Login error:', err);
            
            const newAttempts = loginAttempts + 1;
            setLoginAttempts(newAttempts);
            
            try {
                if (analytics) {
                    logEvent(analytics, 'login_failed', { email, attempts: newAttempts, error: (err as any)?.code });
                }
            } catch (e) { /* ignore */ }

            if (newAttempts >= 5) {
                setLockedUntil(Date.now() + 30 * 1000);
                setError('Çok fazla başarısız deneme. Lütfen 30 saniye bekleyin.');
            } else {
                setError(translateAuthError(err));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setLoading(true);

        try {
            // Önce kalıcılığı ayarla (Mobil tarayıcılar için önemli)
            await setPersistence(auth, browserLocalPersistence);

            const provider = new GoogleAuthProvider();
            // Mobil cihazlarda popup sorunları için Redirect kullanıyoruz
            await signInWithRedirect(auth, provider);
            // Sayfa yönlendirileceği için loading state'i true kalabilir
        } catch (err: unknown) {
            if (import.meta.env.DEV) console.error('Google login error:', err);
            setLoading(false);
            setError(translateAuthError(err));
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-logo">
                    <img src="/images/logo.png" alt="Marte Logo" />
                </div>

                <Card variant="elevated" className="login-card">
                    <div className="login-header">
                        <h1>Hoş Geldiniz</h1>
                        <p>Devam etmek için giriş yapın</p>
                    </div>

                    <form onSubmit={handleLogin} className="login-form">
                        <Input
                            label="E-posta"
                            type="email"
                            placeholder="ornek@email.com"
                            leftIcon={<FiMail />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />

                        <Input
                            label="Şifre"
                            type="password"
                            placeholder="••••••••"
                            leftIcon={<FiLock />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />

                        {error && (
                            <div className="login-error">
                                <FiAlertCircle />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            loading={loading}
                            disabled={lockedUntil !== null && Date.now() < lockedUntil}
                            size="lg"
                        >
                            Giriş Yap
                        </Button>

                        <div className="login-divider">
                            <span>veya</span>
                        </div>

                        <Button
                            type="button"
                            variant="secondary"
                            fullWidth
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            leftIcon={<FcGoogle size={20} />}
                        >
                            Google ile Devam Et
                        </Button>
                    </form>
                </Card>

                <p className="login-footer">
                    &copy; {new Date().getFullYear()} Marte Stüdyo
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
