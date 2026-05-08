// src/components/MemberList.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, Timestamp, query, orderBy, limit, startAfter, where } from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import './MemberList.css';
import { formatPhone } from '../utils/formatPhone';
import { toTurkishTitleCase } from '../utils/formatters';
import { TextField, Button } from '../newUI/primitives';
import { FiMoreHorizontal, FiUser, FiSearch } from 'react-icons/fi';
import PageTransition from './PageTransition';

export interface Member {
  id: string;
  name: string;
  surname: string;
  email?: string;
  memberUid?: string;
  phone?: string;
  birthDate?: Timestamp;
  parentName?: string;
  parentPhone?: string;
  createdAt: Timestamp;
  notes?: string;
  username?: string;
}

interface MemberListProps {
  refreshTrigger: boolean;
  onMemberClick: (member: Member) => void;
}

const PAGE_SIZE = 20;

const MemberList: React.FC<MemberListProps> = ({ refreshTrigger, onMemberClick }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMembers = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setMembers([]);
      setLastVisible(null);
      setHasMore(true);
    }
    setError(null);

    try {
      let q;
      const membersRef = collection(db, 'members');

      if (search.trim()) {
        const searchTerm = toTurkishTitleCase(search.trim());
        q = query(
          membersRef,
          where('name', '>=', searchTerm),
          where('name', '<=', searchTerm + '\uf8ff'),
          orderBy('name'),
          limit(PAGE_SIZE)
        );
        if (isLoadMore && lastVisible) {
          q = query(
            membersRef,
            where('name', '>=', searchTerm),
            where('name', '<=', searchTerm + '\uf8ff'),
            orderBy('name'),
            startAfter(lastVisible),
            limit(PAGE_SIZE)
          );
        }
      } else {
        q = query(membersRef, orderBy('name'), limit(PAGE_SIZE));
        if (isLoadMore && lastVisible) {
          q = query(membersRef, orderBy('name'), startAfter(lastVisible), limit(PAGE_SIZE));
        }
      }

      const querySnapshot = await getDocs(q);

      const newMembers: Member[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<Member, 'id'>
      }));

      if (isLoadMore) {
        setMembers(prev => [...prev, ...newMembers]);
      } else {
        setMembers(newMembers);
      }

      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === PAGE_SIZE);

    } catch (error: any) {
      console.error('Üyeleri çekme hatası:', error);
      setError('Üyeler yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, lastVisible]);

  useEffect(() => {
    fetchMembers(false);
  }, [refreshTrigger]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleLoadMore = () => {
    fetchMembers(true);
  };

  const handleMemberItemClick = (member: Member) => {
    onMemberClick(member);
  };

  return (
    <PageTransition className="member-list space-y-4 pb-24">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-800">Kayıtlı Üyeler</h3>
        <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
          {members.length} Gösteriliyor
        </span>
      </div>

      <div className="relative">
        <TextField
          id="search-member"
          placeholder="Üye ara (İsim ile)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full"
          inputClassName="pl-10"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
          <FiSearch size={18} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="spinner"></div></div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-100">{error}</div>
      ) : members.length === 0 ? (
        <div className="text-gray-500 text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          Kayıtlı üye bulunamadı.
        </div>
      ) : (
        <ul className="space-y-3">
          {members.map(member => (
            <li
              key={member.id}
              className="card clickable p-4 hover:scale-[1.01] transition-transform cursor-pointer flex items-center justify-between group bg-white rounded-2xl shadow-sm border border-gray-100"
              onClick={() => handleMemberItemClick(member)}
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleMemberItemClick(member); }}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0 shadow-inner">
                  {member.name ? member.name.charAt(0).toUpperCase() : <FiUser />}
                  {member.surname ? member.surname.charAt(0).toUpperCase() : ''}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-gray-800 text-base truncate">
                    {toTurkishTitleCase(member.name)} {toTurkishTitleCase(member.surname)}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2 truncate">
                    <span>{formatPhone(member.phone) || 'Telefon Yok'}</span>
                  </div>
                </div>
              </div>
              <div className="text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0 ml-2">
                <FiMoreHorizontal size={24} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && !loading && members.length > 0 && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={handleLoadMore}
            loading={loadingMore}
            variant="neutral"
            tone="outline"
            size="sm"
          >
            Daha Fazla Yükle
          </Button>
        </div>
      )}
    </PageTransition>
  );
}

export default MemberList;
