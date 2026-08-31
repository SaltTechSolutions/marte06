// src/components/AddBranchForm.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Branch } from './BranchList.tsx';
import { Input, Button } from '../design-system/components';
import { FiCheck } from 'react-icons/fi';

interface AddBranchFormProps {
  onBranchAdded: () => void;
  onBranchUpdated: () => void;
  editingBranch: Branch | null;
}

const AddBranchForm: React.FC<AddBranchFormProps> = ({ onBranchAdded, onBranchUpdated, editingBranch }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form filling on editingBranch change
  useEffect(() => {
    if (editingBranch) {
      setName(editingBranch.name);
      setDescription(editingBranch.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setError(null);
  }, [editingBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim()) {
        setError('Branş adı boş olamaz.');
        setLoading(false);
        return;
    }

    const branchData = {
        name: name.trim(),
        description: description.trim(),
    };

    try {
      if (editingBranch) {
        const branchDocRef = doc(db, 'branches', editingBranch.id);
        await updateDoc(branchDocRef, branchData);
        onBranchUpdated();
      } else {
        await addDoc(collection(db, 'branches'), {
          ...branchData,
          createdAt: serverTimestamp(),
        });
        onBranchAdded();
      }

      if (!editingBranch) {
          setName('');
          setDescription('');
      }
    } catch (err: any) {
      console.error(editingBranch ? 'Branş güncelleme hatası:' : 'Branş ekleme hatası:', err);
      setError((editingBranch ? 'Branş güncellenirken bir hata oluştu: ' : 'Branş eklenirken bir hata oluştu: ') + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-base font-bold text-[var(--color-text)]">
        {editingBranch ? 'Branşı Düzenle' : 'Yeni Branş Ekle'}
      </h3>

      <Input
        label="Branş Adı *"
        placeholder="Örn: Pilates, Boks vb."
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
      />

      <div className="space-y-1">
        <label htmlFor="branchDescription" className="text-sm font-medium text-[var(--color-text-secondary)]">
          Açıklama (İsteğe bağlı)
        </label>
        <textarea
          id="branchDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Branş hakkında kısa açıklama..."
          className="w-full p-2.5 bg-[var(--color-bg)] dark:bg-black/30 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow resize-none"
        ></textarea>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={loading}
          variant="primary"
          leftIcon={<FiCheck />}
        >
          {editingBranch ? 'Güncelle' : 'Kaydet'}
        </Button>
      </div>
    </form>
  );
};

export default AddBranchForm;
