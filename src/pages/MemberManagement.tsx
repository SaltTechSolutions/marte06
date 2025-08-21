// src/pages/MemberManagement.tsx
import React, { useState } from 'react';
import AddMemberForm from '../components/AddMemberForm.tsx';
import MemberList from '../components/MemberList.tsx';
import './MemberManagement.css'; // Sayfaya özgü diğer stiller için
import type { Member } from '../components/MemberList.tsx'; // Member tipi için import
import MemberDetailModal from '../components/MemberDetailModal.tsx'; // MemberDetailModal importu eklendi
import { db } from '../firebaseConfig.ts'; // Firebase db instance
import { doc, deleteDoc } from 'firebase/firestore';
import Modal from '../components/Modal';
import { FiPlus } from 'react-icons/fi';


const MemberManagement: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false); // Yeni üye formu dialog
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
      const memberDocRef = doc(db, 'members', memberId);
      await deleteDoc(memberDocRef);
      console.log('Member deleted successfully with ID:', memberId);
      
      // After successful deletion from the backend:
      handleCloseMemberDetailModal(); // Close the modal
      setRefreshList(prev => !prev); // Refresh the member list
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Üye silinirken bir hata oluştu.');
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
        title={editingMember ? 'Üyeyi Düzenle' : 'Yeni Üye Ekle'}
      >
        <AddMemberForm
          onMemberAdded={handleMemberAdded}
          onMemberUpdated={handleMemberUpdated}
          editingMember={editingMember}
          initialData={editingMember || undefined}
          onCancel={() => { setShowAddForm(false); setEditingMember(null); }}
        />
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
