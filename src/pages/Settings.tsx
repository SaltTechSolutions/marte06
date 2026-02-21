// src/pages/Settings.tsx
import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { db, storage } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '../components/ToastContext';
import { FiSave, FiUploadCloud, FiImage } from 'react-icons/fi';
import { AppShell, Header, BottomNav, Card, Button } from '../design-system/components';

interface BusinessProfile {
  ownerName: string;
  businessName: string;
  phone: string;
  address: string;
  iban: string;
  logoUrl: string;
}

const SETTINGS_DOC_ID = 'business_profile';

const Settings: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<BusinessProfile>({
    ownerName: '',
    businessName: '',
    phone: '',
    address: '',
    iban: '',
    logoUrl: ''
  });

  // Cropper states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as BusinessProfile);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
      await setDoc(docRef, profile, { merge: true });
      showSuccess('İşletme ayarları başarıyla kaydedildi.');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      showError('Ayarlar kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Boyut kontrolü (örn. 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError('Lütfen 5MB\'dan daha küçük bir fotoğraf yükleyin.');
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null);
        setCropping(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const getCroppedImg = async (imageSrc: string, crop: Area): Promise<string> => {
    const createImage = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
      });

    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Kare ve maksimum 512x512 olacak şekilde ölçekle ve kırp (performans/optimizasyon için)
    const MAX_SIZE = 512;
    const scale = Math.min(MAX_SIZE / crop.width, MAX_SIZE / crop.height, 1);

    canvas.width = crop.width * scale;
    canvas.height = crop.height * scale;

    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width * scale,
      crop.height * scale
    );

    // Çözünürlük ve boyut düşürme (JPEG kalite 0.8)
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      setSaving(true);
      showSuccess('Logo işleniyor, lütfen bekleyin...');

      const croppedImageBase64 = await getCroppedImg(imageSrc, croppedAreaPixels);

      const logoRef = ref(storage, 'settings/logo.jpg');
      await uploadString(logoRef, croppedImageBase64, 'data_url');
      const downloadUrl = await getDownloadURL(logoRef);

      setProfile(prev => ({ ...prev, logoUrl: downloadUrl }));
      const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
      await setDoc(docRef, { logoUrl: downloadUrl }, { merge: true });

      setCropping(false);
      setImageSrc(null);
      showSuccess('Logo başarıyla güncellendi.');
    } catch (err: any) {
      console.error('Error cropping/uploading image:', err);
      showError('Logo yüklenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--color-text-secondary)]">Ayarlar yükleniyor...</div>;
  }

  return (
    <AppShell
      header={<Header title="İşletme Ayarları" />}
      bottomNav={<BottomNav />}
    >
      <div className="p-4 pb-[calc(var(--bottom-nav-height)+1.5rem)] max-w-2xl mx-auto space-y-6">

        {/* Logo Section */}
        <Card variant="elevated" className="!p-5">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <FiImage className="text-[var(--color-primary)]" /> Salon Logosu
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-2xl bg-[var(--color-bg-subtle)] border-2 border-dashed border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Salon Logosu" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-[var(--color-text-muted)] text-center px-2">Logo Yüklenmedi</span>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full">
              <p className="text-sm text-[var(--color-text-secondary)] m-0">Logonuz kare formatında (1:1) kesilerek sisteme uygun hale getirilecektir.</p>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-100)] text-[var(--color-primary-700)] rounded-lg text-sm font-medium hover:bg-[var(--color-primary-200)] transition-colors">
                  <FiUploadCloud /> Yeni Logo Seç
                </span>
                <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden" onChange={onFileChange} />
              </label>
            </div>
          </div>
        </Card>

        {/* Business Details Form */}
        <Card variant="elevated" className="!p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)] m-0">İşletme Bilgileri</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Yetkili / İşletme Sahibi Adı Soyadı</label>
              <input
                type="text"
                name="ownerName"
                value={profile.ownerName}
                onChange={handleChange}
                placeholder="Örn: Tarkan Çiçek"
                className="w-full p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Salon / İşletme Adı</label>
              <input
                type="text"
                name="businessName"
                value={profile.businessName}
                onChange={handleChange}
                placeholder="Örn: Tarabya Marte"
                className="w-full p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">İletişim Numarası</label>
              <input
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleChange}
                placeholder="Örn: 0555 555 55 55"
                className="w-full p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">IBAN / Banka Hesap Bilgisi</label>
              <input
                type="text"
                name="iban"
                value={profile.iban}
                onChange={handleChange}
                placeholder="Örn: TR00 0000 0000 0000 0000 0000 00 (X Bankası)"
                className="w-full p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Bu bilgi üyelerin ödeme yaparken/havale yaparken göreceği bilgidir.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Açık Adres</label>
              <textarea
                name="address"
                value={profile.address}
                onChange={handleChange}
                rows={3}
                placeholder="Salonun tam açık adresi..."
                className="w-full p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow resize-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              leftIcon={<FiSave />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </Button>
          </div>
        </Card>

      </div>

      {/* Cropper Modal Overlay */}
      {cropping && imageSrc && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col pt-safe">
          <div className="relative flex-1">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1 / 1} /* Kare formatı zorunlu kılıyor */
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 flex flex-col gap-4 pb-safe">
            <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-200">
              Logonuzu kare çerçevenin içerisine ortalayın.
            </p>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="flex justify-between gap-4 mt-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => { setCropping(false); setImageSrc(null); }}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                className="w-full"
                onClick={handleCropSave}
                disabled={saving}
              >
                Kırp ve Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
};

export default Settings;
