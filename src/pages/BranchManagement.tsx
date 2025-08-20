// src/pages/BranchManagement.tsx
import React, { useState } from 'react';
import AddBranchForm from '../components/AddBranchForm.tsx'; // AddBranchForm'u import et
import BranchList from '../components/BranchList.tsx'; // BranchList'i import et
import './BranchManagement.css';
import type { Branch } from '../components/BranchList.tsx'; // Branch interface'ini import et

const BranchManagement: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshList, setRefreshList] = useState(false); // Liste yenileme için state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null); // Düzenlenmekte olan branş state'i eklendi

  // Branş ekleme başarılı olunca tetiklenir
  const handleBranchAdded = () => {
    setShowAddForm(false); // Formu gizle
    setRefreshList(prev => !prev); // Listeyi yenile
    setEditingBranch(null); // Yeni ekleme sonrası editingBranch'i temizle
  };

  // Branş silme başarılı olunca tetiklenir
  const handleBranchDeleted = () => {
      setRefreshList(prev => !prev); // Refresh the list after deletion
      // TODO: Potentially show a success message
  };

  // Branş düzenle butonuna basılınca tetiklenir
  const handleBranchEdited = (branch: Branch) => {
      console.log('Branş düzenleme istendi:', branch);
      setEditingBranch(branch); // Düzenlenmekte olan branşı state'e kaydet
      setShowAddForm(true); // Formu göster
  };

    // Branş güncelleme başarılı olunca tetiklenir (AddBranchForm tarafından çağrılır)
    const handleBranchUpdated = () => {
        setEditingBranch(null); // Düzenleme sonrası editingBranch'i temizle
        setShowAddForm(false); // Formu gizle
        setRefreshList(prev => !prev); // Listeyi yenile
        // TODO: Potentially show a success message
    };


  return (
    <div className="branch-management-page space-y-3"> {/* Ana konteyner */}
      <div className="flex items-center justify-end"> {/* Üst aksiyon alanı */}
        <button
          className="px-4 py-2 rounded-md bg-primary text-white text-sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Formu Gizle' : editingBranch ? 'Branşı Düzenle' : 'Yeni Branş Ekle'}
        </button>
      </div>

      {/* Yeni Branş Ekle / Düzenle Formu (showAddForm true ise gösterilecek) */}
      {showAddForm && (
        <div className="add-branch-form-container bg-white rounded-lg shadow-card p-3"> {/* Form konteyneri */}
          <AddBranchForm 
            onBranchAdded={handleBranchAdded} 
            onBranchUpdated={handleBranchUpdated} /* Güncelleme callback'i pass edildi */
            editingBranch={editingBranch} /* editingBranch state'i pass edildi */
          />
        </div>
      )}

      {/* Branş Listesi */}
      <div className="branch-list-container bg-white rounded-lg shadow-card"> {/* Liste konteyneri */}
        <div className="p-3">
          <BranchList 
            refreshTrigger={refreshList} 
            onBranchDeleted={handleBranchDeleted} /* Pass delete handler */
            onBranchEdited={handleBranchEdited} /* Pass edit handler */
          /> {/* Listeyi kullandık ve trigger prop'unu verdik */}
        </div>
      </div>
    </div>
  );
};

export default BranchManagement;
