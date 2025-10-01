// src/pages/MemberManagement.tsx
import React, { useState } from 'react';
import AddMemberForm from '../components/AddMemberForm.tsx';
import AddMemberFormMultiStep from '../components/AddMemberFormMultiStep.tsx';
import MemberList from '../components/MemberList.tsx';
import './MemberManagement.css'; // Sayfaya özgü diğer stiller için
import type { Member } from '../components/MemberList.tsx'; // Member tipi için import
import MemberDetailModal from '../components/MemberDetailModal.tsx'; // MemberDetailModal importu eklendi
import Modal from '../components/Modal';
import { FiPlus } from 'react-icons/fi';
import { useToast } from '../components/ToastContext';
import { deleteMemberWithCascade } from '../utils/memberOperations';


const MemberManagement: React.FC = () => {
  const { showError, showSuccess } = useToast();
  const [showAddForm, setShowAddForm] = useState(false); // Yeni üye formu dialog
  const [useMultiStepForm] = useState(true); // Multi-step form toggle (can be changed to false for old form)
  const [refreshList, setRefreshList] = useState(false); // Liste yenileme için state
  const [editingMember, setEditingMember] = useState<Member | null>(null); // Düzenlenen üye state'i
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false); // Üye detay modalı görünürlük state'i
  const [memberForDetail, setMemberForDetail] = useState<Member | null>(null); // Detayı gösterilecek üye state'i


  // Üye ekleme başarılı olunca tetiklenir
  const handleMemberAdded = () => {
    setShowAddForm(false);
    setRefreshList(prev => !prev);
    setEditingMember(null);
  };

  const handleMemberUpdated = () => {
    setShowAddForm(false);
    setRefreshList(prev => !prev);
    setEditingMember(null);
  };



  // Üye listesinde bir üyeye tıklanınca tetiklenir
  const handleMemberClick = (member: Member) => {
      setMemberForDetail(member); // Detayı gösterilecek üyeyi state'e kaydet
      setShowMemberDetailModal(true); // Detay modalını göster
  };

  // Üye detay modalından düzenleme talebi gelince tetiklenir
  const handleEditMember = (member: Member) => {
    setShowMemberDetailModal(false);
    setEditingMember(member);
    setShowAddForm(true);
  };

  // Üye detay modalından silme talebi gelince tetiklenir
  const handleDeleteMember = async (memberId: string) => {
    try {
      // Get member UID from memberForDetail
      const memberUid = memberForDetail?.memberUid;
      
      // Use cascade delete logic
      const result = await deleteMemberWithCascade(memberId, memberUid, {
        deletePayments: false, // Keep payment history
        keepPastLessons: true // Keep past lessons for historical data
      });
      
      if (result.success) {
        console.log(`Member deleted successfully. ${result.deletedCount} records affected.`);
        showSuccess(`Üye başarıyla silindi. ${result.deletedCount} kayıt etkilendi.`);
        handleCloseMemberDetailModal(); // Close the modal
        setRefreshList(prev => !prev); // Refresh the member list
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      showError('Üye silinirken bir hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  };

  // Üye detay modalı kapatılınca tetiklenir
  const handleCloseMemberDetailModal = () => {
      setMemberForDetail(null); // Detay gösterilecek üyeyi temizle
      setShowMemberDetailModal(false); // Detay modalını gizle
       // Detay modalında güncelleme/silme yapılmışsa listeyi yenile
       setRefreshList(prev => !prev);
  };

  return (
    <div className="space-y-3">
      <div className="card">
        <MemberList
          refreshTrigger={refreshList}
          onMemberClick={handleMemberClick}
        />
      </div>

      <Modal
        isOpen={showAddForm}
        onClose={() => { setShowAddForm(false); setEditingMember(null); }}
        title={useMultiStepForm ? '' : (editingMember ? 'Üyeyi Düzenle' : 'Yeni Üye Ekle')}
      >
        {useMultiStepForm ? (
          <AddMemberFormMultiStep
            onMemberAdded={handleMemberAdded}
            onMemberUpdated={handleMemberUpdated}
            editingMember={editingMember}
            onCancel={() => { setShowAddForm(false); setEditingMember(null); }}
          />
        ) : (
          <AddMemberForm
            onMemberAdded={handleMemberAdded}
            onMemberUpdated={handleMemberUpdated}
            editingMember={editingMember}
            initialData={editingMember || undefined}
            onCancel={() => { setShowAddForm(false); setEditingMember(null); }}
          />
        )}
      </Modal>

      {showMemberDetailModal && memberForDetail && (
        <MemberDetailModal
          isVisible={showMemberDetailModal}
          onClose={handleCloseMemberDetailModal}
          member={memberForDetail}
          onMemberUpdate={handleEditMember}
          onDelete={handleDeleteMember}
        />
      )}

      {/* FAB for quick add on mobile, positioned above BottomNav */}
      <button
        className="fab"
        aria-label="Yeni Üye"
        onClick={() => { setEditingMember(null); setShowAddForm(true); }}
        title="Yeni Üye"
      >
        <FiPlus />
      </button>
    </div>
  );
};

export default MemberManagement;
