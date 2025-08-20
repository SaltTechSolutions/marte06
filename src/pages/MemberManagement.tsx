// src/pages/MemberManagement.tsx
import React, { useState } from 'react';
import AddMemberForm from '../components/AddMemberForm.tsx';
import MemberList from '../components/MemberList.tsx';
import './MemberManagement.css'; // Sayfaya özgü diğer stiller için
import type { Member } from '../components/MemberList.tsx'; // Member tipi için import
import MemberDetailModal from '../components/MemberDetailModal.tsx'; // MemberDetailModal importu eklendi
import { db } from '../firebaseConfig.ts'; // Firebase db instance
import { doc, deleteDoc } from 'firebase/firestore';
import { Container, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, Fab, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';


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
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2 }}>
        <MemberList
          refreshTrigger={refreshList}
          onMemberClick={handleMemberClick}
        />
      </Paper>

      <Dialog open={showAddForm} onClose={() => { setShowAddForm(false); setEditingMember(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{editingMember ? 'Üyeyi Düzenle' : 'Yeni Üye Ekle'}</DialogTitle>
        <DialogContent dividers>
          <AddMemberForm
            onMemberAdded={handleMemberAdded}
            onMemberUpdated={handleMemberUpdated}
            editingMember={editingMember}
            initialData={editingMember || undefined}
            onCancel={() => { setShowAddForm(false); setEditingMember(null); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowAddForm(false); setEditingMember(null); }}>Kapat</Button>
        </DialogActions>
      </Dialog>

      {showMemberDetailModal && memberForDetail && (
        <MemberDetailModal
          isVisible={showMemberDetailModal}
          onClose={handleCloseMemberDetailModal}
          member={memberForDetail}
          onMemberUpdate={handleEditMember}
          onDelete={handleDeleteMember}
        />
      )}

      {/* Optional FAB for quick add on mobile, positioned above BottomNav */}
      <Box sx={{ position: 'fixed', right: 16, bottom: 96, zIndex: 110 }}>
        <Fab color="primary" aria-label="Yeni Üye" onClick={() => { setEditingMember(null); setShowAddForm(true); }}>
          <AddIcon />
        </Fab>
      </Box>
    </Container>
  );
};

export default MemberManagement;
