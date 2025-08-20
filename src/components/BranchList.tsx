// src/components/BranchList.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
//import type { DocumentData } from 'firebase/firestore'; // Belge verisi tipi - KULLANILMIYOR

export interface Branch {
    id: string;
    name: string;
    address: string;
    phone: string;
    description: string; // Added description
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
                console.error('Error fetching branches:', e.message);
                setError('Failed to load branches: ' + e.message);
                setBranches([]);
            } finally {
                setLoading(false);
            }
        };

        fetchBranches();
    }, [refreshTrigger]);

    const handleDeleteBranch = async (branchId: string) => {
        try {
            const branchDocRef = doc(db, 'branches', branchId);
            await deleteDoc(branchDocRef);
            // Silme başarılıysa listeyi güncelle
            setBranches(prevBranches => prevBranches.filter(branch => branch.id !== branchId));
            onBranchDeleted && onBranchDeleted();
        } catch (e: any) {
            console.error('Error deleting branch:', e.message);
            setError('Failed to delete branch: ' + e.message);
        }
    };

    if (loading) {
        return <p className="text-center py-2 text-gray-600">Branşlar yükleniyor...</p>;
    }

    if (error) {
        return <p className="text-red-600" role="alert">{error}</p>;
    }

    return (
        <div className="branch-list space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Branşlar</h3>
            {branches.length > 0 ? (
                <ul className="space-y-2">
                    {branches.map(branch => (
                        <li
                            key={branch.id}
                            className="rounded-md border border-border p-3 bg-white flex items-start justify-between gap-3"
                        >
                            <div>
                                <div className="text-base font-medium text-gray-800">{branch.name}</div>
                                <div className="mt-1 text-sm text-gray-700">{branch.address}</div>
                                {branch.phone && <div className="text-sm text-gray-600">{branch.phone}</div>}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    onClick={() => onBranchEdited && onBranchEdited(branch)}
                                    className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs"
                                >
                                    Düzenle
                                </button>
                                <button
                                    onClick={() => handleDeleteBranch(branch.id)}
                                    className="px-3 py-1 rounded-md bg-red-600 text-white text-xs"
                                >
                                    Sil
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-600 py-4 text-center">Kayıtlı branş bulunamadı.</p>
            )}
        </div>
    );
};

export default BranchList;
