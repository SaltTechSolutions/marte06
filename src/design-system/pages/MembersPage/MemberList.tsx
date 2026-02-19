// src/design-system/pages/MembersPage/MemberList.tsx
// Gerçek Firebase verilerini kullanan üye listesi

import React from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Card, Avatar, Badge, Button } from '../../components';
import { toJSDate, calculateAge } from '../../../utils/dateHelpers';
import { FiPhone, FiMail, FiEdit2, FiChevronRight } from 'react-icons/fi';
import './MemberList.css';

export interface Member {
    id: string;
    name: string;
    surname: string;
    email?: string;
    phone?: string;
    birthDate?: any;
    isActive?: boolean;
    notes?: string;
    username?: string;
    tempPassword?: string;
    createdAt: any;
    parentName?: string;
    parentPhone?: string;
}

interface MemberListProps {
    onMemberClick?: (member: Member) => void;
    onEditClick?: (member: Member) => void;
}

export const MemberList: React.FC<MemberListProps> = ({
    onMemberClick,
    onEditClick,
}) => {
    const { data: members, loading, error } = useFirestoreCollection('members', [], { realtime: true });

    if (loading) {
        return (
            <div className="member-list-loading">
                <div className="member-list-spinner" />
                <p>Üyeler yükleniyor...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="member-list-error">
                <p>Üyeler yüklenirken bir hata oluştu.</p>
                <p className="member-list-error-detail">{error}</p>
            </div>
        );
    }

    if (!members || members.length === 0) {
        return (
            <div className="member-list-empty">
                <div className="member-list-empty-icon">👥</div>
                <h3>Henüz üye yok</h3>
                <p>İlk üyeyi eklemek için "Yeni Üye" butonuna tıklayın.</p>
            </div>
        );
    }

    // Sort by name
    const sortedMembers = [...members].sort((a, b) => {
        const nameA = `${a.name || ''} ${a.surname || ''}`.toLocaleLowerCase('tr');
        const nameB = `${b.name || ''} ${b.surname || ''}`.toLocaleLowerCase('tr');
        return nameA.localeCompare(nameB, 'tr');
    });

    return (
        <div className="member-list">
            {sortedMembers.map((member) => {
                const fullName = `${member.name || ''} ${member.surname || ''}`.trim();
                const birthDate = toJSDate(member.birthDate);
                const age = birthDate ? calculateAge(birthDate) : null;
                const isActive = member.isActive !== false;

                return (
                    <Card
                        key={member.id}
                        variant="outlined"
                        padding="none"
                        interactive
                        className="member-card"
                        onClick={() => onMemberClick?.(member as Member)}
                    >
                        <div className="member-card-content">
                            <Avatar name={fullName} size="md" />

                            <div className="member-card-info">
                                <div className="member-card-header">
                                    <h3 className="member-card-name">{fullName}</h3>
                                    <Badge variant={isActive ? 'success' : 'default'} size="sm">
                                        {isActive ? 'Aktif' : 'Pasif'}
                                    </Badge>
                                </div>

                                <div className="member-card-details">
                                    {member.phone && (
                                        <span className="member-card-detail">
                                            <FiPhone size={14} />
                                            {member.phone}
                                        </span>
                                    )}
                                    {member.email && (
                                        <span className="member-card-detail">
                                            <FiMail size={14} />
                                            {member.email}
                                        </span>
                                    )}
                                    {age !== null && (
                                        <span className="member-card-detail">
                                            {age} yaş
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="member-card-actions">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditClick?.(member as Member);
                                    }}
                                    aria-label="Düzenle"
                                >
                                    <FiEdit2 size={16} />
                                </Button>
                                <FiChevronRight className="member-card-chevron" size={20} />
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

export default MemberList;
