// src/components/MemberSelectModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import type { Member } from './MemberList.tsx'; // Import Member interface
import './MemberSelectModal.css'; // CSS dosyası

interface MemberSelectModalProps {
  isVisible: boolean;
  onClose: () => void; // Callback to close the modal
  onSave: (selectedMemberIds: string[]) => void; // Callback with selected member IDs
  existingSelectedMemberIds: string[]; // IDs of members already selected for the date
}

const MemberSelectModal: React.FC<MemberSelectModalProps> = ({ isVisible, onClose, onSave, existingSelectedMemberIds }) => {
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  // Turkish alphabetical sorting for member full names
  const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);
  const sortedMembers = useMemo(
    () =>
      [...allMembers].sort((a, b) =>
        collator.compare(`${a.name ?? ''} ${a.surname ?? ''}`.trim(), `${b.name ?? ''} ${b.surname ?? ''}`.trim()),
      ),
    [allMembers, collator],
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(existingSelectedMemberIds);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return; // Only fetch when modal becomes visible

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'members'));
        const membersData: Member[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Member, 'id'>
        }));
        setAllMembers(membersData);
      } catch (error: any) {
        console.error('Üyeleri çekme hatası:', error);
        setError('Üyeler yüklenirken bir hata oluştu: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [isVisible]); // Re-run effect when modal visibility changes

  // Sync internal selectedMemberIds state with external prop when modal opens
  useEffect(() => {
      if (isVisible) {
          setSelectedMemberIds(existingSelectedMemberIds);
      }
  }, [isVisible, existingSelectedMemberIds]);


  const handleCheckboxChange = (memberId: string, isChecked: boolean) => {
    setSelectedMemberIds(prevSelectedIds => {
      if (isChecked) {
        return [...prevSelectedIds, memberId];
      } else {
        return prevSelectedIds.filter(id => id !== memberId);
      }
    });
  };

  const handleSaveClick = () => {
    onSave(selectedMemberIds); // Pass selected IDs back to parent
    // Modal will be closed by parent via onClose callback after saving
  };

  if (!isVisible) return null; // Don't render if not visible

  return (
    <div className="modal-overlay"> {/* CSS for overlay */} 
      <div className="modal-content"> {/* CSS for modal content */} 
        <h3>Üye Seçimi</h3>

        {loading && <p>Üyeler yükleniyor...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {!loading && !error && allMembers.length > 0 && (
          <div className="member-list-select"> {/* CSS for member list */} 
            {sortedMembers.map(member => (
              <div key={member.id} className="member-select-item"> {/* CSS for each member item */} 
                <input
                  type="checkbox"
                  id={`member-${member.id}`}
                  checked={selectedMemberIds.includes(member.id)}
                  onChange={(e) => handleCheckboxChange(member.id, e.target.checked)}
                />
                <label htmlFor={`member-${member.id}`}>{member.name} {member.surname}</label>
              </div>
            ))}
          </div>
        )}

         {!loading && !error && allMembers.length === 0 && <p>Kayıtlı üye bulunamadı.</p>}

        <div className="modal-actions"> {/* CSS for buttons */} 
          <button onClick={handleSaveClick} className="confirm-button">Kaydet</button>
          <button onClick={onClose} className="cancel-button">İptal</button>
        </div>
      </div>
    </div>
  );
};

export default MemberSelectModal;
