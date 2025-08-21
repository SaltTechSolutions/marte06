// src/components/LoginForm.tsx
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth objesini import et
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'; // Giriş fonksiyonlarını ve Google Auth sağlayıcısını import et
import { useNavigate } from 'react-router-dom';
import googleLogo from '../images/google-logo.png'; // Google logosunu import et
import { MdMailOutline } from 'react-icons/md';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); // Hata mesajı için state
  const [loading, setLoading] = useState(false); // Loading state'i eklendi
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Önceki hataları temizle
    setLoading(true); // Giriş yapılırken loading true yap

    try {
      // Firebase Authentication ile giriş yap
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Giriş başarılı:', userCredential.user);
      navigate('/members');
    } catch (error: any) {
      console.error('Giriş hatası:', error.message);
      setError(error.message); // Hata mesajını state'e kaydet
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
            // This gives you a Google Access Token. You can use it to access the Google API.
            // const credential = GoogleAuthProvider.credentialFromResult(result);
            // const token = credential?.accessToken;
            console.log('Google ile giriş başarılı:', result.user);
            navigate('/members');
        } catch (error: any) {
            console.error('Google ile giriş hatası:', error.message);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };


  return (
    <div className="login-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <form onSubmit={handleSubmit} aria-label="Giriş Formu">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              className="input"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <input
              className="input"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p role="alert" aria-live="polite" style={{ color: 'var(--color-error)', marginBottom: '0.5rem' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            aria-label="Giriş Yap"
            title="Giriş Yap"
            style={{ width: '100%', marginBottom: 8 }}
          >
            <MdMailOutline size={18} /> {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="btn btn-outline"
            aria-label="Google ile Giriş Yap"
            title="Google ile Giriş Yap"
            style={{ width: '100%' }}
          >
            <img src={googleLogo} alt="Google" className="google-btn-icon" />
            {loading ? 'Google ile Giriş Yapılıyor...' : 'Google ile Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;