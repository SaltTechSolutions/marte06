// src/design-system/pages/LoginPage/LoginPage.tsx
// Yeni design system ile modern login sayfası

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from '../../../firebaseConfig';
import { Button, Input, Card } from '../../components';
import { FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { ADMIN_EMAILS } from '../../../constants/auth';
import './LoginPage.css';

interface LoginPageProps {
    redirectTo?: string;
    adminOnly?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
    redirectTo = '/dashboard',
    adminOnly = true // Admin login varsayılan
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const translateAuthError = (err: any): string => {
        const code = err?.code;
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
        const checkRedirectResult = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    if (adminOnly) {
                        const email = result.user.email?.toLowerCase() || '';
                        if (!ADMIN_EMAILS.includes(email)) {
                            await signOut(auth);
                            throw new Error('Yetkisiz erişim. Sadece yöneticiler giriş yapabilir.');
                        }
                    }
                    navigate(redirectTo);
                }
            } catch (err: any) {
                console.error('Redirect login error:', err);
                if (err.message === 'Yetkisiz erişim. Sadece yöneticiler giriş yapabilir.') {
                    setError(err.message);
                } else {
                    setError(`Giriş hatası: ${err.message}`);
                }
            }
        };

        checkRedirectResult();
    }, [adminOnly, navigate, redirectTo]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Admin check
            if (adminOnly) {
                const normalizedEmail = email.trim().toLowerCase();
                if (!ADMIN_EMAILS.includes(normalizedEmail)) {
                    throw new Error('Yetkisiz erişim. Sadece yöneticiler giriş yapabilir.');
                }
            }

            await signInWithEmailAndPassword(auth, email, password);
            navigate(redirectTo);
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message === 'Yetkisiz erişim. Sadece yöneticiler giriş yapabilir.' ? err.message : translateAuthError(err));
            if (err.message.includes('Yetkisiz')) {
                await signOut(auth);
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
            // Sayfa yönlendirileceği için loading state'i true kalabilir veya işlem burada biter
        } catch (err: any) {
            console.error('Google login error:', err);
            setLoading(false);
            if (err.message === 'Yetkisiz erişim. Sadece yöneticiler giriş yapabilir.') {
                setError(err.message);
            } else {
                setError(`Giriş hatası: ${err.message}`);
            }
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
