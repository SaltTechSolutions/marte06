// src/components/BranchList.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Card, Button } from '../design-system/components';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';

export interface Branch {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    description?: string;
}

interface BranchListProps {
  refreshTrigger: boolean;
  onBranchDeleted?: () => void;
  onBranchEdited?: (branch: Branch) => void;
}

const BranchList: React.FC<BranchListProps> = ({ refreshTrigger, onBranchDeleted, onBranchEdited }) => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Turkish sorting by name
    const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);
    const sortedBranches = useMemo(
      () => [...branches].sort((a, b) => collator.compare(a.name || '', b.name || '')),
      [branches, collator]
    );

    useEffect(() => {
        const fetchBranches = async () => {
            setLoading(true);
            setError(null);

            try {
                const branchesCollection = collection(db, 'branches');
                const querySnapshot = await getDocs(branchesCollection);
                const branchesData: Branch[] = querySnapshot.docs.map(d => ({
                    id: d.id,
                    ...(d.data() as Omit<Branch, 'id'>),
                }));
                setBranches(branchesData);
            } catch (e: any) {
                console.error('Branşlar yüklenirken hata:', e.message);
                setError('Branşlar yüklenirken bir hata oluştu: ' + e.message);
                setBranches([]);
            } finally {
                setLoading(false);
            }
        };

        fetchBranches();
    }, [refreshTrigger]);

    const handleDeleteBranch = async (branchId: string) => {
        const confirmed = window.confirm('Bu branşı silmek istediğinizden emin misiniz?');
        if (!confirmed) return;

        try {
            const branchDocRef = doc(db, 'branches', branchId);
            await deleteDoc(branchDocRef);
            setBranches(prevBranches => prevBranches.filter(branch => branch.id !== branchId));
            onBranchDeleted && onBranchDeleted();
        } catch (e: any) {
            console.error('Branş silinirken hata:', e.message);
            setError('Branş silinirken bir hata oluştu: ' + e.message);
        }
    };

    if (loading) {
        return <p className="text-center py-6 text-sm text-[var(--color-text-secondary)]">Branşlar yükleniyor...</p>;
    }

    if (error) {
        return (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl text-xs text-red-700 dark:text-red-400" role="alert">
            {error}
          </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-base font-bold text-[var(--color-text)]">Mevcut Branşlar</h3>
            {sortedBranches.length > 0 ? (
                <div className="space-y-3">
                    {sortedBranches.map(branch => (
                        <Card
                            key={branch.id}
                            variant="outlined"
                            className="!p-3.5 flex items-start justify-between gap-3 hover:scale-[1.01] transition-transform duration-200"
                        >
                            <div className="space-y-1 min-w-0">
                                <div className="text-base font-semibold text-[var(--color-text)] truncate">{branch.name}</div>
                                {branch.description && (
                                    <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{branch.description}</div>
                                )}
                                {branch.address && <div className="text-xs text-[var(--color-text-muted)]">{branch.address}</div>}
                                {branch.phone && <div className="text-xs text-[var(--color-text-muted)]">{branch.phone}</div>}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <Button
                                    onClick={() => onBranchEdited && onBranchEdited(branch)}
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<FiEdit2 />}
                                >
                                    Düzenle
                                </Button>
                                <Button
                                    onClick={() => handleDeleteBranch(branch.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950/30"
                                    leftIcon={<FiTrash2 />}
                                >
                                    Sil
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-[var(--color-text-muted)] py-6 text-center text-sm">Kayıtlı branş bulunamadı.</p>
            )}
        </div>
    );
};

export default BranchList;
