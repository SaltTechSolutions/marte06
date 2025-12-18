// src/design-system/pages/MembersPage/MembersPage.tsx
// Üyeler listesi sayfası - Firebase verilerini kullanır

import React, { useState, useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { useAuth } from '../../../utils/AuthContext';
import { toJSDate, calculateAge } from '../../../utils/dateHelpers';
import {
    Card,
    Button,
    Input,
    Avatar,
    Badge,
    AppShell,
    Header,
    BottomNav,
} from '../../components';
import {
    FiSearch,
    FiPlus,
    FiPhone,
    FiMail,
    FiFilter,
    FiChevronRight,
    FiX,
} from 'react-icons/fi';
import './MembersPage.css';
import MemberDetailModal from '../../../components/MemberDetailModal';
import { AddMemberWizard } from './AddMemberWizard';
import { useSearchParams } from 'react-router-dom';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

interface Member {
    id: string;
    name: string;
    surname: string;
    email?: string;
    phone?: string;
    birthDate?: unknown;
    isActive?: boolean;
    notes?: string;
    createdAt?: unknown;
}

export const MembersPage: React.FC = () => {
    const { userRole } = useAuth();
    const { data: members, loading, error } = useFirestoreCollection('members', [], { realtime: true });

    const [searchParams, setSearchParams] = useSearchParams();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Check URL params for add action
    React.useEffect(() => {
        if (searchParams.get('add') === 'true') {
            setIsAddModalOpen(true);
        }
    }, [searchParams]);

    const handleCloseAddModal = () => {
        setIsAddModalOpen(false);
        // Clear URL param if exists
        if (searchParams.get('add') === 'true') {
            searchParams.delete('add');
            setSearchParams(searchParams);
        }
    };

    // ... (existing usage of filteredMembers, stats etc.)

    const [searchQuery, setSearchQuery] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // Filter and search members (same as before)
    const filteredMembers = useMemo(() => {
        // ... (keep existing logic)
        if (!members) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (members as any[])
            .filter((member) => {
                const fullName = `${member.name || ''} ${member.surname || ''}`.toLowerCase();
                const phone = (member.phone || '').toLowerCase();
                const email = (member.email || '').toLowerCase();
                const query = searchQuery.toLowerCase();

                const matchesSearch = !query ||
                    fullName.includes(query) ||
                    phone.includes(query) ||
                    email.includes(query);

                const isActive = member.isActive !== false;
                const matchesFilter =
                    filterActive === 'all' ||
                    (filterActive === 'active' && isActive) ||
                    (filterActive === 'inactive' && !isActive);

                return matchesSearch && matchesFilter;
            })
            .sort((a, b) => {
                const nameA = `${a.name || ''} ${a.surname || ''}`.toLocaleLowerCase('tr');
                const nameB = `${b.name || ''} ${b.surname || ''}`.toLocaleLowerCase('tr');
                return nameA.localeCompare(nameB, 'tr');
            });
    }, [members, searchQuery, filterActive]);

    const stats = useMemo(() => {
        if (!members) return { total: 0, active: 0, inactive: 0 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const active = (members as any[]).filter((m) => m.isActive !== false).length;
        return {
            total: members.length,
            active,
            inactive: members.length - active,
        };
    }, [members]);

    const handleMemberClick = (member: Member) => {
        setSelectedMember(member);
    };

    const handleDeleteMember = async (memberId: string) => {
        try {
            await deleteDoc(doc(db, 'members', memberId));
            setSelectedMember(null);
        } catch (error) {
            console.error('Error deleting member:', error);
            alert('Üye silinirken bir hata oluştu.');
        }
    };

    return (
        <AppShell
            header={
                <Header
                    title="Üyeler"
                    rightAction={
                        userRole === 'admin' && (
                            <Button variant="primary" size="sm" leftIcon={<FiPlus />} onClick={() => setIsAddModalOpen(true)}>
                                Yeni
                            </Button>
                        )
                    }
                />
            }
            bottomNav={<BottomNav />}
        >
            <div className="members-page">
                {/* Search & Filter */}
                <div className="members-toolbar">
                    {/* ... (keep existing toolbar) */}
                    <div className="members-search">
                        <Input
                            placeholder="Üye ara..."
                            leftIcon={<FiSearch size={18} />}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            fullWidth
                            rightIcon={
                                searchQuery ? (
                                    <button className="members-search-clear" onClick={() => setSearchQuery('')}>
                                        <FiX size={16} />
                                    </button>
                                ) : undefined
                            }
                        />
                    </div>
                    <button
                        className={`members-filter-btn ${showFilters ? 'active' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FiFilter size={18} />
                        {filterActive !== 'all' && <span className="members-filter-dot" />}
                    </button>
                </div>

                {/* Filter Pills */}
                {showFilters && (
                    <div className="members-filters">
                        <button
                            className={`members-filter-pill ${filterActive === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterActive('all')}
                        >
                            Tümü ({stats.total})
                        </button>
                        <button
                            className={`members-filter-pill ${filterActive === 'active' ? 'active' : ''}`}
                            onClick={() => setFilterActive('active')}
                        >
                            Aktif ({stats.active})
                        </button>
                        <button
                            className={`members-filter-pill ${filterActive === 'inactive' ? 'active' : ''}`}
                            onClick={() => setFilterActive('inactive')}
                        >
                            Pasif ({stats.inactive})
                        </button>
                    </div>
                )}

                {/* Results count */}
                <div className="members-results-count">
                    {filteredMembers.length} üye bulundu
                </div>

                {/* Member List */}
                {loading ? (
                    <div className="members-loading">
                        <div className="members-spinner" />
                        <p>Üyeler yükleniyor...</p>
                    </div>
                ) : error ? (
                    <div className="members-error">
                        <p>Üyeler yüklenirken bir hata oluştu.</p>
                    </div>
                ) : filteredMembers.length === 0 ? (
                    <div className="members-empty">
                        <div className="members-empty-icon">👥</div>
                        <h3>{searchQuery ? 'Sonuç bulunamadı' : 'Henüz üye yok'}</h3>
                        <p>
                            {searchQuery
                                ? 'Farklı anahtar kelimelerle aramayı deneyin.'
                                : 'İlk üyeyi eklemek için "Yeni" butonuna tıklayın.'}
                        </p>
                    </div>
                ) : (
                    <div className="members-list">
                        {filteredMembers.map((member: Member) => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                onClick={() => handleMemberClick(member)}
                            />
                        ))}
                    </div>
                )}

                {/* Member Detail Modal */}
                {selectedMember && (
                    <MemberDetailModal
                        isVisible={!!selectedMember}
                        member={selectedMember as any}
                        onClose={() => setSelectedMember(null)}
                        onDelete={handleDeleteMember}
                        onMemberUpdate={() => { }} // Realtime listener handles list update
                    />
                )}

                {/* Add Member Modal */}
                <AddMemberWizard isOpen={isAddModalOpen} onClose={handleCloseAddModal} />
            </div>
        </AppShell>
    );
};

// ... (keep existing MemberCard and MemberDetail components)

// Add Member Modal Component



// Member Card Component
interface MemberCardProps {
    member: Member;
    onClick: () => void;
}

const MemberCard: React.FC<MemberCardProps> = ({ member, onClick }) => {
    const fullName = `${member.name || ''} ${member.surname || ''}`.trim();
    const birthDate = toJSDate(member.birthDate);
    const age = birthDate ? calculateAge(birthDate) : null;
    const isActive = member.isActive !== false;

    return (
        <Card
            variant="outlined"
            padding="none"
            interactive
            className="member-card"
            onClick={onClick}
        >
            <div className="member-card-content">
                <Avatar name={fullName} size="md" />

                <div className="member-card-info">
                    <div className="member-card-header">
                        <h3 className="member-card-name">{fullName || 'İsimsiz'}</h3>
                        <Badge variant={isActive ? 'success' : 'default'} size="sm">
                            {isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                    </div>

                    <div className="member-card-details">
                        {member.phone && (
                            <span className="member-card-detail">
                                <FiPhone size={12} />
                                {member.phone}
                            </span>
                        )}
                        {member.email && (
                            <span className="member-card-detail">
                                <FiMail size={12} />
                                {member.email}
                            </span>
                        )}
                        {age !== null && (
                            <span className="member-card-detail">{age} yaş</span>
                        )}
                    </div>
                </div>

                <FiChevronRight className="member-card-chevron" size={20} />
            </div>
        </Card>
    );
};





export default MembersPage;
