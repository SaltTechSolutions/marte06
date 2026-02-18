// src/design-system/pages/PackagesPage/PackagesPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { AppShell, Header, BottomNav, Button, Card, Modal, ModalFooter, Input, Badge } from '../../components';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiClock, FiHash } from 'react-icons/fi';
import './PackagesPage.css';

interface Package {
    id: string;
    name: string;
    price: number;
    sessionCount?: number;
    durationDays?: number;
    description?: string;
    isActive: boolean;
}

export const PackagesPage: React.FC = () => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentPackage, setCurrentPackage] = useState<Package | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [sessionCount, setSessionCount] = useState('');
    const [durationDays, setDurationDays] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    // Confirm Delete
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);

    const fetchPackages = useCallback(async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'packages'));
            const packagesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Package[];

            setPackages(packagesData.sort((a, b) => collator.compare(a.name || '', b.name || '')));
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error fetching packages:", error);
        } finally {
            setLoading(false);
        }
    }, [collator]);

    useEffect(() => {
        fetchPackages();
    }, [fetchPackages]);

    const resetForm = () => {
        setName('');
        setPrice('');
        setSessionCount('');
        setDurationDays('');
        setDescription('');
        setIsActive(true);
        setFormError(null);
        setCurrentPackage(null);
        setEditMode(false);
    };

    const handleOpenAdd = () => {
        resetForm();
        setEditMode(false);
        setModalOpen(true);
    };

    const handleOpenEdit = (pkg: Package) => {
        resetForm();
        setEditMode(true);
        setCurrentPackage(pkg);
        setName(pkg.name);
        setPrice(pkg.price.toString());
        setSessionCount(pkg.sessionCount?.toString() || '');
        setDurationDays(pkg.durationDays?.toString() || '');
        setDescription(pkg.description || '');
        setIsActive(pkg.isActive);
        setModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError(null);

        try {
            if (!name || !price) {
                throw new Error("Ad ve Fiyat alanları zorunludur.");
            }

            const packageData = {
                name,
                price: parseFloat(price),
                sessionCount: sessionCount ? parseInt(sessionCount) : null,
                durationDays: durationDays ? parseInt(durationDays) : null,
                description,
                isActive,
                createdAt: currentPackage ? undefined : Timestamp.now() // Only update createdAt for new
            };

            // Remove undefined fields
            if (packageData.createdAt === undefined) delete (packageData as any).createdAt;

            if (editMode && currentPackage) {
                await updateDoc(doc(db, 'packages', currentPackage.id), packageData);
            } else {
                await addDoc(collection(db, 'packages'), {
                    ...packageData,
                    createdAt: Timestamp.now()
                });
            }

            setModalOpen(false);
            fetchPackages();
        } catch (error: any) {
            setFormError(error.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            // Check if any assigned_packages reference this package
            const assignedQ = query(collection(db, 'assigned_packages'), where('packageId', '==', deleteId));
            const assignedSnap = await getDocs(assignedQ);
            if (assignedSnap.size > 0) {
                const confirmed = window.confirm(
                    `Bu pakete bağlı ${assignedSnap.size} üye kaydı var. Paketi silmek bu kayıtları etkilemez, ancak paket artık görünmeyecek. Devam etmek istiyor musunuz?`
                );
                if (!confirmed) {
                    setDeleteId(null);
                    return;
                }
            }
            await deleteDoc(doc(db, 'packages', deleteId));
            setDeleteId(null);
            fetchPackages();
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error deleting package:", error);
        }
    };

    return (
        <AppShell
            header={
                <Header
                    title="Paket Yönetimi"
                    rightAction={
                        <Button variant="primary" size="sm" onClick={handleOpenAdd} leftIcon={<FiPlus />}>
                            Yeni Paket
                        </Button>
                    }
                />
            }
            bottomNav={<BottomNav />}
        >
            <div className="packages-page">
                {loading ? (
                    <div className="packages-loading">Yükleniyor...</div>
                ) : (
                    <div className="packages-grid">
                        {packages.map(pkg => (
                            <Card key={pkg.id} className="package-card" padding="none">
                                <div className="package-card-inner">
                                    <div className="package-header">
                                        <div className="package-title-group">
                                            <h3 className="package-title">{pkg.name}</h3>
                                            <Badge variant={pkg.isActive ? 'success' : 'default'} size="sm" className="package-status">
                                                {pkg.isActive ? 'Aktif' : 'Pasif'}
                                            </Badge>
                                        </div>
                                        <div className="package-price">
                                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(pkg.price)}
                                        </div>
                                    </div>

                                    <div className="package-meta">
                                        <div className="meta-item">
                                            <FiHash className="meta-icon" />
                                            <span>{pkg.sessionCount ? `${pkg.sessionCount} Ders` : 'Sınırsız'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <FiClock className="meta-icon" />
                                            <span>{pkg.durationDays ? `${pkg.durationDays} Gün` : 'Süresiz'}</span>
                                        </div>
                                    </div>

                                    {pkg.description && (
                                        <p className="package-description-compact">
                                            {pkg.description}
                                        </p>
                                    )}

                                    <div className="package-actions-compact">
                                        <button
                                            className="action-btn edit"
                                            onClick={() => handleOpenEdit(pkg)}
                                            aria-label="Düzenle"
                                        >
                                            <FiEdit2 size={18} />
                                        </button>
                                        <button
                                            className="action-btn delete"
                                            onClick={() => setDeleteId(pkg.id)}
                                            aria-label="Sil"
                                        >
                                            <FiTrash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Edit/Add Modal */}
                <Modal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    title={editMode ? "Paketi Düzenle" : "Yeni Paket Ekle"}
                >
                    <form onSubmit={handleSave} className="package-form">
                        <Input
                            label="Paket Adı"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Örn: 10 Derslik Paket"
                            required
                        />
                        <Input
                            label="Fiyat (TL)"
                            type="number"
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                        <div className="form-row">
                            <Input
                                label="Ders Sayısı"
                                type="number"
                                value={sessionCount}
                                onChange={e => setSessionCount(e.target.value)}
                                placeholder="Opsiyonel"
                            />
                            <Input
                                label="Süre (Gün)"
                                type="number"
                                value={durationDays}
                                onChange={e => setDurationDays(e.target.value)}
                                placeholder="Opsiyonel"
                            />
                        </div>
                        <Input
                            label="Açıklama"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Paket detayları..."
                        />

                        <div className="form-checkbox">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={e => setIsActive(e.target.checked)}
                                />
                                <span>Aktif Paket</span>
                            </label>
                        </div>

                        {formError && <div className="form-error">{formError}</div>}

                        <ModalFooter>
                            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={formLoading}>İptal</Button>
                            <Button type="submit" variant="primary" loading={formLoading} leftIcon={<FiCheck />}>Kaydet</Button>
                        </ModalFooter>
                    </form>
                </Modal>

                {/* Confirm Delete Modal */}
                <Modal
                    isOpen={!!deleteId}
                    onClose={() => setDeleteId(null)}
                    title="Paketi Sil"
                >
                    <p>Bu paketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                    <ModalFooter>
                        <Button variant="secondary" onClick={() => setDeleteId(null)}>İptal</Button>
                        <Button variant="danger" onClick={handleDelete} leftIcon={<FiTrash2 />}>Sil</Button>
                    </ModalFooter>
                </Modal>
            </div>
        </AppShell>
    );
};

export default PackagesPage;
