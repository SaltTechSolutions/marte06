// src/components/MemberList.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import './MemberList.css';
import { formatPhone } from '../utils/formatPhone';
import { toTurkishTitleCase } from '../utils/formatters';

export interface Member {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone?: string;
  birthDate?: Timestamp;
  parentName?: string;
  parentPhone?: string;
  createdAt: Timestamp;
  notes?: string;
}

interface MemberListProps {
  refreshTrigger: boolean;
  onMemberClick: (member: Member) => void;
}

const MemberList: React.FC<MemberListProps> = ({ refreshTrigger, onMemberClick }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  // Turkish collator for proper alphabetical sorting
  const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);

  // Compute filtered + sorted list BEFORE any early returns to keep hook order stable
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    const qDigits = q.replace(/\D/g, '');
    const list = members.filter((member) => {
      if (!q) return true;
      const nameLC = (member.name ? member.name : '').toLocaleLowerCase('tr-TR');
      const surnameLC = (member.surname ? member.surname : '').toLocaleLowerCase('tr-TR');
      const emailLC = (member.email ? member.email : '').toLocaleLowerCase('tr-TR');
      const phoneNorm = formatPhone(member.phone).replace(/\s/g, '');
      const matchesText = nameLC.includes(q) || surnameLC.includes(q) || emailLC.includes(q);
      const matchesPhone = qDigits.length > 0 && phoneNorm.includes(qDigits);
      return matchesText || matchesPhone;
    });
    return [...list].sort((a, b) =>
      collator.compare(`${a.name ?? ''} ${a.surname ?? ''}`.trim(), `${b.name ?? ''} ${b.surname ?? ''}`.trim()),
    );
  }, [members, search, collator]);

  useEffect(() => {
    setSearch('');
  }, [refreshTrigger]);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'members'));
        const membersData: Member[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Member, 'id'>
        }));
        setMembers(membersData);
      } catch (error: any) {
        console.error('Üyeleri çekme hatası:', error);
        setError('Üyeler yüklenirken bir hata oluştu: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [refreshTrigger]);

  if (loading) {
    return <div>Üyeler yükleniyor...</div>;
  }

  if (error) {
    return <div className="error-message" role="alert">{error}</div>;
  }

  // (moved above)

  if (members.length === 0) {
    return <div>Henüz kayıtlı üye bulunmamaktadır.</div>;
  }



   // Handle click on the member list item (to open detail modal)
  const handleMemberItemClick = (member: Member) => {
      onMemberClick(member); // Call the parent's member click handler
  };

  return (
    <>
      <div className="member-list space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-color)]">Kayıtlı Üyeler</h3>
        <input
          type="text"
          placeholder="Üye ara (isim, soyisim, e-posta, telefon)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2 w-full max-w-xs rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Üye ara"
        />
        <ul>
          {filteredMembers.length === 0 ? (
            <li style={{ color: 'var(--muted-color)', padding: '0.5rem' }}>Aramanıza uygun üye bulunamadı.</li>
          ) : (
            <>
              {filteredMembers.map(member => (
                <li 
                  key={member.id} 
                  className="member-list-item card clickable rounded-md border border-border p-3 hover:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  tabIndex={0}
                  aria-label={`Üye: ${toTurkishTitleCase(member.name)} ${toTurkishTitleCase(member.surname)}`}
                  onClick={() => handleMemberItemClick(member)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleMemberItemClick(member); }}
                >
                  <span>
                    {toTurkishTitleCase(member.name)} {toTurkishTitleCase(member.surname)} - {formatPhone(member.phone) || 'Telefon Yok'}
                    {member.notes && ` - Not: ${member.notes}`}
                  </span>

                </li>
              ))}
            </>
          )}
        </ul>
      </div>

    </>
  );
}

export default MemberList;
