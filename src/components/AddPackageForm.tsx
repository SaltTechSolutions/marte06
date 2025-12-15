// src/components/AddPackageForm.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Package } from '../types/Package';
import { formatPrice } from '../utils/formatters';
import { Button, TextField, SelectField } from '../newUI/primitives';
import { FiSave, FiCheckCircle } from 'react-icons/fi';

interface AddPackageFormProps {
  onSuccess: () => void;
  existingPackage?: Package | null;
}

const AddPackageForm: React.FC<AddPackageFormProps> = ({ onSuccess, existingPackage }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [displayPrice, setDisplayPrice] = useState('');
  const [lessonCount, setLessonCount] = useState<number | ''>('');
  const [durationDays, setDurationDays] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingPackage) {
      setName(existingPackage.name);
      setDescription(existingPackage.description || '');
      setPrice(existingPackage.price);
      setDisplayPrice(formatPrice(existingPackage.price));
      setLessonCount(existingPackage.lessonCount ?? '');
      setDurationDays(existingPackage.durationDays ?? '');
      setIsActive(existingPackage.isActive ?? true);
    } else {
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
    if (lessonCount !== '' && Number(lessonCount) < 0) {
      setError('Ders sayısı negatif olamaz.');
      setLoading(false);
      return;
    }
    if (durationDays !== '' && Number(durationDays) < 0) {
      setError('Süre negatif olamaz.');
      setLoading(false);
      return;
    }

    const packageData = {
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      lessonCount: lessonCount === '' ? null : Number(lessonCount),
      durationDays: durationDays === '' ? null : Number(durationDays),
      isActive: isActive,
    };

    try {
      if (existingPackage) {
        const packageDocRef = doc(db, 'packages', existingPackage.id);
        await updateDoc(packageDocRef, packageData);
        onSuccess();
      } else {
        await addDoc(collection(db, 'packages'), {
          ...packageData,
          createdAt: serverTimestamp(),
        });
        onSuccess();
      }

      if (!existingPackage) {
        setName('');
        setDescription('');
        setPrice('');
        setDisplayPrice('');
        setLessonCount('');
        setDurationDays('');
        setIsActive(true);
      }

    } catch (error: any) {
      console.error('Hata:', error);
      setError('İşlem sırasında bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TextField
        id="packageName"
        label="Paket Adı"
        placeholder="Örn: 10 Derslik Paket"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <TextField
        id="packageDescription"
        label="Açıklama (İsteğe bağlı)"
        placeholder="Paket detayları..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        multiline
        rows={3}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextField
          id="packagePrice"
          label="Fiyat (TL)"
          placeholder="0"
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
        />

        <TextField
          id="packageLessonCount"
          label="Ders Sayısı"
          type="number"
          placeholder="Sınırsız için boş bırakın"
          value={lessonCount}
          onChange={(e) => setLessonCount(e.target.value === '' ? '' : Number(e.target.value))}
          min="0"
        />

        <TextField
          id="packageDurationDays"
          label="Süre (Gün)"
          type="number"
          placeholder="Süresiz için boş bırakın"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
          min="0"
        />
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer" onClick={() => setIsActive(!isActive)}>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isActive ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white'}`}>
          {isActive && <FiCheckCircle size={16} />}
        </div>
        <span className="text-gray-700 font-medium select-none">Bu paket aktif olarak satışta</span>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          tone="solid"
          fullWidth
          loading={loading}
          icon={<FiSave />}
        >
          {existingPackage ? 'Değişiklikleri Kaydet' : 'Paketi Oluştur'}
        </Button>
      </div>
    </form>
  );
};

export default AddPackageForm;
