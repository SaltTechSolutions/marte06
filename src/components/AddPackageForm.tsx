// src/components/AddPackageForm.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Package } from '../types/Package';
import { formatPrice } from '../utils/formatters';

interface AddPackageFormProps {
  onSuccess: () => void;
  existingPackage?: Package | null;
}

const AddPackageForm: React.FC<AddPackageFormProps> = ({ onSuccess, existingPackage }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [displayPrice, setDisplayPrice] = useState('');
  const [lessonCount, setLessonCount] = useState<number | ''>(''); // Ders sayısı
  const [durationDays, setDurationDays] = useState<number | ''>(''); // Süre (gün)
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false); // loading state
  const [error, setError] = useState<string | null>(null); // error state

  // Populate form when existingPackage changes
  useEffect(() => {
    if (existingPackage) {
      setName(existingPackage.name);
      setDescription(existingPackage.description || '');
      setPrice(existingPackage.price);
      setDisplayPrice(formatPrice(existingPackage.price));
      setLessonCount(existingPackage.lessonCount === null || existingPackage.lessonCount === undefined ? '' : existingPackage.lessonCount); // Handle null or undefined
      setDurationDays(existingPackage.durationDays === null || existingPackage.durationDays === undefined ? '' : existingPackage.durationDays); // Handle null or undefined
      setIsActive(existingPackage.isActive !== undefined ? existingPackage.isActive : true);
    } else {
      // Clear form for new package
      setName('');
      setDescription('');
      setPrice('');
      setDisplayPrice('');
      setLessonCount('');
      setDurationDays('');
      setIsActive(true);
    }
    setError(null);
  }, [existingPackage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim()) {
        setError('Paket adı boş olamaz.');
        setLoading(false);
        return;
    }
    if (price === '' || price < 0) {
      setError('Geçerli bir fiyat girin.');
      setLoading(false);
      return;
    }
    // Check lessonCount and durationDays for negative values only if they are not empty string or null
    if (lessonCount !== '' && lessonCount !== null && Number(lessonCount) < 0) { 
        setError('Ders sayısı negatif olamaz.');
        setLoading(false);
        return;
    }
    if (durationDays !== '' && durationDays !== null && Number(durationDays) < 0) { 
        setError('Süre negatif olamaz.');
        setLoading(false);
        return;
    }

    const packageData = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        lessonCount: lessonCount === '' ? null : Number(lessonCount), // Save as null if empty string
        durationDays: durationDays === '' ? null : Number(durationDays), // Save as null if empty string
        isActive: isActive,
    };

    try {
      if (existingPackage) {
        // Update package
        const packageDocRef = doc(db, 'packages', existingPackage.id);
        await updateDoc(packageDocRef, packageData);
        console.log('Paket güncellendi:', existingPackage.id);
        onSuccess(); // Call update callback
      } else {
        // Add new package
        await addDoc(collection(db, 'packages'), {
          ...packageData,
          createdAt: serverTimestamp(),
        });
        console.log('Yeni paket eklendi');
        onSuccess(); // Call added callback
      }

      // Clear form if not in editing mode (or if editing is complete and form is hidden)
       if (!existingPackage) {
            setName('');
            setDescription('');
            setPrice('');
            setDisplayPrice('');
            setLessonCount('');
            setDurationDays('');
            setIsActive(true);
       } // else: form will be cleared/hidden by parent (PackageManagement)

    } catch (error: any) {
      console.error(existingPackage ? 'Paket güncelleme hatası:' : 'Paket ekleme hatası:', error);
      setError((existingPackage ? 'Paket güncellenirken bir hata oluştu: ' : 'Paket eklenirken bir hata oluştu: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="section">
        <div className="form-group">
          <label htmlFor="packageName">Paket Adı</label>
          <input
            className="input"
            type="text"
            id="packageName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="packageDescription">Açıklama (isteğe bağlı)</label>
          <textarea
            className="input"
            id="packageDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="packagePrice">Fiyat (TL)</label>
          <input
            className="input"
            id="packagePrice"
            type="text" /* text to allow formatted input */
            value={displayPrice}
            onChange={(e) => {
              const rawValue = e.target.value.replace(/\./g, '');
              const numValue = rawValue === '' ? '' : parseInt(rawValue, 10);
              if (!isNaN(Number(numValue))) {
                setPrice(numValue);
                setDisplayPrice(numValue === '' ? '' : formatPrice(Number(numValue)));
              }
            }}
            required
            min="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="packageLessonCount">Ders Sayısı (boş bırakılabilir)</label>
          <input
            className="input"
            type="number"
            id="packageLessonCount"
            value={lessonCount}
            onChange={(e) => setLessonCount(e.target.value === '' ? '' : Number(e.target.value))}
            min="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="packageDurationDays">Süre (gün) (boş bırakılabilir)</label>
          <input
            className="input"
            type="number"
            id="packageDurationDays"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
            min="0"
          />
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="packageIsActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="packageIsActive">Aktif mi?</label>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading
              ? existingPackage
                ? 'Güncelleniyor...'
                : 'Ekleniyor...'
              : existingPackage
              ? 'Güncelle'
              : 'Kaydet'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default AddPackageForm;
