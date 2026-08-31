// src/pages/BranchManagement.tsx
import React, { useState } from 'react';
import AddBranchForm from '../components/AddBranchForm.tsx';
import BranchList from '../components/BranchList.tsx';
import type { Branch } from '../components/BranchList.tsx';
import { AppShell, Header, BottomNav, Button, Card } from '../design-system/components';
import { FiPlus, FiEyeOff } from 'react-icons/fi';

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
  };

  // Branş düzenle butonuna basılınca tetiklenir
  const handleBranchEdited = (branch: Branch) => {
      setEditingBranch(branch); // Düzenlenmekte olan branşı state'e kaydet
      setShowAddForm(true); // Formu göster
  };

  // Branş güncelleme başarılı olunca tetiklenir (AddBranchForm tarafından çağrılır)
  const handleBranchUpdated = () => {
      setEditingBranch(null); // Düzenleme sonrası editingBranch'i temizle
      setShowAddForm(false); // Formu gizle
      setRefreshList(prev => !prev); // Listeyi yenile
  };

  return (
    <AppShell
      header={
        <Header 
          title="Branş Yönetimi" 
          rightAction={
            <Button
              variant={showAddForm ? 'secondary' : 'primary'}
              size="sm"
              leftIcon={showAddForm ? <FiEyeOff /> : <FiPlus />}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? 'Formu Gizle' : editingBranch ? 'Branşı Düzenle' : 'Yeni Branş Ekle'}
            </Button>
          }
        />
      }
      bottomNav={<BottomNav />}
    >
      <div className="p-4 pb-[calc(var(--bottom-nav-height)+1.5rem)] max-w-2xl mx-auto space-y-4">
        
        {/* Yeni Branş Ekle / Düzenle Formu */}
        {showAddForm && (
          <Card variant="elevated" className="!p-5">
            <AddBranchForm 
              onBranchAdded={handleBranchAdded} 
              onBranchUpdated={handleBranchUpdated}
              editingBranch={editingBranch}
            />
          </Card>
        )}

        {/* Branş Listesi */}
        <Card variant="elevated" className="!p-4">
          <BranchList 
            refreshTrigger={refreshList} 
            onBranchDeleted={handleBranchDeleted}
            onBranchEdited={handleBranchEdited}
          />
        </Card>
      </div>
    </AppShell>
  );
};

export default BranchManagement;
