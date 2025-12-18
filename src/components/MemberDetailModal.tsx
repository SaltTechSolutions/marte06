// src/components/MemberDetailModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { Member } from './MemberList';
import type { Package } from '../types/Package';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, Timestamp, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { formatDateToDDMMYY, formatDateToYYYYMMDD, formatPrice } from '../utils/formatters';
import Modal from './Modal';
import { FiTrash2, FiSave, FiEdit2, FiPlus } from 'react-icons/fi';
import { toTurkishTitleCase } from '../utils/formatters';
import { useAuth } from '../utils/AuthContext';
import { Button, TextField, SelectField } from '../newUI/primitives';

interface AssignedPackage {
    id: string;
    packageId: string;
    packageName: string;
    startDate: Timestamp;
    endDate: Timestamp | null;
    assignedAt: Timestamp;
    totalLessonCount?: number;
    packagePrice?: number;
    autoPaymentId?: string;
    attendedLessons: number;
    calculatedRemainingLessons: number;
    outstandingBalance: number;
}

interface Payment {
    id: string;
    amount: number;
    date: Timestamp;
    notes?: string;
    recordedAt: Timestamp;
}

interface MemberDetailModalProps {
    isVisible: boolean;
    onClose: () => void;
    member: Member;
    onDelete: (memberId: string) => void;
    onMemberUpdate: (updatedMember: Member) => void;
}

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ isVisible, onClose, member, onDelete, onMemberUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editableMember, setEditableMember] = useState<Member>(member);
    const [assignedPackages, setAssignedPackages] = useState<AssignedPackage[]>([]);
    const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
    const [loadingAssignedPackages, setLoadingAssignedPackages] = useState(false);

    const [fetchError, setFetchError] = useState<string | null>(null);
    const [selectedPackageToAssign, setSelectedPackageToAssign] = useState<string>('');
    const [assignedPackageStartDate, setAssignedPackageStartDate] = useState<string>(formatDateToYYYYMMDD(new Date()));
    const [assigningPackage, setAssigningPackage] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(formatDateToYYYYMMDD(new Date()));
    const [recordingPayment, setRecordingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin';

    const getBirthDateInputValue = (): string => {
        const bd: any = (editableMember as any).birthDate;
        if (!bd) return '';
        return typeof bd === 'string' ? bd : formatDateToYYYYMMDD(bd);
    };

    const fetchAssignedPackages = async () => {
        if (!member) return;
        setLoadingAssignedPackages(true);
        setFetchError(null);
        try {
            const q = query(collection(db, 'assigned_packages'), where('memberId', '==', member.id));
            const querySnapshot = await getDocs(q);
            const basePackages: AssignedPackage[] = [];
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data() as any;
                const packageDocRef = doc(db, 'packages', data.packageId);
                const packageDoc = await getDoc(packageDocRef);
                const packageName = packageDoc.exists() ? (packageDoc.data() as any).name : 'Bilinmeyen Paket';

                basePackages.push({
                    id: docSnap.id,
                    packageId: data.packageId,
                    packageName,
                    startDate: data.startDate,
                    endDate: data.endDate ?? null,
                    assignedAt: data.assignedAt,
                    totalLessonCount: data.totalLessonCount,
                    packagePrice: data.packagePrice,
                    attendedLessons: 0,
                    calculatedRemainingLessons: data.totalLessonCount || 0,
                    outstandingBalance: data.packagePrice || 0,
                } as AssignedPackage);
            }

            const lessonsQ = query(collection(db, 'lessons'), where('memberIds', 'array-contains', member.id));
            const lessonsSnap = await getDocs(lessonsQ);
            const lessons = lessonsSnap.docs
                .map(d => {
                    const raw = d.data() as any;
                    const ts = raw?.date;
                    const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
                    const attendedIds: string[] = Array.isArray(raw?.attendedMemberIds) ? raw.attendedMemberIds : [];
                    return dt ? { date: dt, attendedIds } : null;
                })
                .filter((x): x is { date: Date; attendedIds: string[] } => Boolean(x));

            const now = new Date();
            const computed = basePackages.map((pkg) => {
                const start = pkg.startDate.toDate();
                const end = pkg.endDate ? pkg.endDate.toDate() : now;
                const attended = lessons.filter(l => l.date >= start && l.date <= end && l.attendedIds.includes(member.id)).length;
                const remaining = Math.max(0, (pkg.totalLessonCount || 0) - attended);
                return { ...pkg, attendedLessons: attended, calculatedRemainingLessons: remaining } as AssignedPackage;
            });

            setAssignedPackages(computed);
        } catch (error) {
            console.error('Error fetching assigned packages:', error);
            setFetchError('Atanmış paketler yüklenirken bir hata oluştu.');
        } finally {
            setLoadingAssignedPackages(false);
        }
    };

    const fetchAvailablePackages = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'packages'));
            const packages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
            setAvailablePackages(packages);
        } catch (error) {
            console.error('Error fetching available packages:', error);
            setFetchError('Mevcut paketler yüklenirken bir hata oluştu.');
        }
    };

    const fetchPaymentHistory = async () => {
        if (!member) return;
        setLoadingPaymentHistory(true);
        try {
            const q = query(collection(db, 'payments'), where('memberId', '==', member.id));
            const querySnapshot = await getDocs(q);
            const payments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            setPaymentHistory(payments.sort((a, b) => b.date.toMillis() - a.date.toMillis()));
        } catch (error) {
            console.error('Error fetching payment history:', error);
            setFetchError('Ödeme geçmişi yüklenirken bir hata oluştu.');
        } finally {
            setLoadingPaymentHistory(false);
        }
    };

    const pkgCollator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);
    const sortedActivePackages = useMemo(
        () => [...availablePackages]
            .filter((p) => p.isActive)
            .sort((a, b) => pkgCollator.compare(a.name || '', b.name || '')),
        [availablePackages, pkgCollator]
    );

    useEffect(() => {
        if (isVisible) {
            setEditableMember(member);
            setIsEditing(false);
            fetchAssignedPackages();
            fetchAvailablePackages();
            fetchPaymentHistory();
        } else {
            setAssignedPackages([]);
            setAvailablePackages([]);
            setPaymentHistory([]);
            setFetchError(null);
        }
    }, [member, isVisible]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditableMember(prev => ({ ...prev, [name]: value }));
    };

    const handleDeleteClick = () => {
        if (window.confirm(`${member.name} isimli üyeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            onDelete(member.id);
        }
    };

    const handleUpdateMember = async () => {
        try {
            const memberRef = doc(db, 'members', member.id);
            const bd: any = (editableMember as any).birthDate;
            let normalizedBirthDate: Timestamp | null = null;
            if (bd) {
                if (typeof bd === 'string') {
                    const d = new Date(bd);
                    normalizedBirthDate = isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
                } else if (bd.toDate && typeof bd.toDate === 'function') {
                    normalizedBirthDate = bd as Timestamp;
                } else if (bd instanceof Date) {
                    normalizedBirthDate = Timestamp.fromDate(bd);
                }
            }

            const updatedData = {
                ...editableMember,
                name: toTurkishTitleCase(editableMember.name),
                birthDate: normalizedBirthDate,
            };
            await updateDoc(memberRef, updatedData);
            setIsEditing(false);
            onMemberUpdate({ ...editableMember, name: toTurkishTitleCase(editableMember.name), birthDate: normalizedBirthDate as any });
        } catch (error) {
            console.error('Error updating member:', error);
        }
    };

    const handleAssignPackage = async () => {
        if (!selectedPackageToAssign || !assignedPackageStartDate) {
            setAssignError('Lütfen bir paket seçin ve başlangıç tarihi girin.');
            return;
        }
        setAssigningPackage(true);
        setAssignError(null);
        try {
            const selectedPackage = availablePackages.find(p => p.id === selectedPackageToAssign);
            if (!selectedPackage) throw new Error('Seçilen paket bulunamadı.');

            let computedEnd: Timestamp | null = null;
            try {
                if (selectedPackage.durationDays != null) {
                    const start = new Date(assignedPackageStartDate);
                    const end = new Date(start);
                    const days = Number(selectedPackage.durationDays) || 0;
                    if (days > 0) {
                        end.setDate(end.getDate() + days - 1);
                        computedEnd = Timestamp.fromDate(end);
                    }
                }
            } catch { }

            await addDoc(collection(db, 'assigned_packages'), {
                memberId: member.id,
                packageId: selectedPackageToAssign,
                startDate: Timestamp.fromDate(new Date(assignedPackageStartDate)),
                endDate: computedEnd,
                assignedAt: serverTimestamp(),
                totalLessonCount: selectedPackage.lessonCount || null,
                packagePrice: selectedPackage.price || null,
            });

            setSelectedPackageToAssign('');
            setAssignedPackageStartDate(formatDateToYYYYMMDD(new Date()));
            fetchAssignedPackages();
        } catch (error) {
            console.error('Error assigning package:', error);
            setAssignError('Paket atanırken bir hata oluştu.');
        } finally {
            setAssigningPackage(false);
        }
    };

    const handleRecordPayment = async () => {
        if (!paymentAmount || Number(paymentAmount) <= 0 || !paymentDate) {
            setPaymentError('Lütfen geçerli bir miktar ve tarih girin.');
            return;
        }
        setRecordingPayment(true);
        setPaymentError(null);
        try {
            await addDoc(collection(db, 'payments'), {
                memberId: member.id,
                amount: Number(paymentAmount),
                date: Timestamp.fromDate(new Date(paymentDate)),
                recordedAt: serverTimestamp(),
                notes: '',
            });

            setPaymentAmount('');
            setPaymentDate(formatDateToYYYYMMDD(new Date()));
            fetchPaymentHistory();
            fetchAssignedPackages();
        } catch (error) {
            console.error('Error recording payment:', error);
            setPaymentError('Ödeme kaydedilirken bir hata oluştu.');
        } finally {
            setRecordingPayment(false);
        }
    };

    const handleDeleteAssignedPackage = async (packageId: string) => {
        if (window.confirm('Bu paketi silmek istediğinizden emin misiniz?')) {
            try {
                const packageRef = doc(db, 'assigned_packages', packageId);
                await deleteDoc(packageRef);
                fetchAssignedPackages();
            } catch (error) {
                console.error('Error deleting assigned package:', error);
            }
        }
    };

    return (
        <Modal
            isOpen={isVisible}
            onClose={onClose}
            title={isEditing ? 'Üye Bilgilerini Düzenle' : 'Üye Detayları'}
            actions={
                <div className="flex gap-2">
                    {isEditing ? (
                        <Button variant="primary" tone="solid" onClick={handleUpdateMember} icon={<FiSave />}>Kaydet</Button>
                    ) : (
                        <Button variant="neutral" tone="outline" onClick={() => setIsEditing(true)} icon={<FiEdit2 />}>Düzenle</Button>
                    )}
                    <Button variant="danger" tone="solid" onClick={handleDeleteClick} icon={<FiTrash2 />}>Sil</Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Member Info Section */}
                <div className="space-y-4">
                    {isEditing ? (
                        <>
                            <TextField id="name" label="İsim" name="name" value={editableMember.name} onChange={handleInputChange} />
                            <TextField id="phone" label="Telefon" name="phone" value={editableMember.phone} onChange={handleInputChange} />
                            <TextField id="email" label="E-posta" name="email" type="email" value={editableMember.email || ''} onChange={handleInputChange} />
                            <TextField id="birthDate" label="Doğum Tarihi" name="birthDate" type="date" value={getBirthDateInputValue()} onChange={handleInputChange} />
                            <TextField id="notes" label="Notlar" name="notes" value={editableMember.notes || ''} onChange={handleInputChange} />
                        </>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">İsim:</span> <span className="font-medium">{toTurkishTitleCase(member.name)}</span></div>
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Telefon:</span> <span>{member.phone}</span></div>
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">E-posta:</span> <span>{member.email || '-'}</span></div>
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Doğum Tarihi:</span> <span>{member.birthDate ? formatDateToDDMMYY(member.birthDate) : '-'}</span></div>
                            <div className="flex justify-between pb-2"><span className="text-gray-500">Notlar:</span> <span>{member.notes || '-'}</span></div>
                            {isAdmin && (
                                <>
                                    <div className="flex justify-between border-t pt-2"><span className="text-gray-500">Kullanıcı Adı:</span> <span>{member.username || member.email || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Geçici Şifre:</span> <span>{member.tempPassword || '-'}</span></div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Packages Section */}
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Atanmış Paketler</h4>
                    {loadingAssignedPackages ? (
                        <div className="spinner"></div>
                    ) : fetchError ? (
                        <div className="text-red-500 text-sm">{fetchError}</div>
                    ) : assignedPackages.length > 0 ? (
                        <ul className="space-y-2 mb-4">
                            {assignedPackages.map((pkg) => (
                                <li key={pkg.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                                    <div className="text-sm">
                                        <div className="font-medium text-gray-800">{pkg.packageName}</div>
                                        <div className="text-gray-500 text-xs">{formatDateToDDMMYY(pkg.startDate)} - Kalan: {pkg.calculatedRemainingLessons}</div>
                                    </div>
                                    <Button variant="danger" tone="ghost" size="sm" onClick={() => handleDeleteAssignedPackage(pkg.id)} icon={<FiTrash2 />} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 mb-4">Paket bulunamadı.</p>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <h5 className="text-sm font-semibold text-gray-700">Yeni Paket Ata</h5>
                        <SelectField
                            id="assign-package"
                            label="Paket Seç"
                            value={selectedPackageToAssign}
                            onChange={(e) => setSelectedPackageToAssign(e.target.value)}
                            options={[
                                { value: '', label: '-- Paket Seçin --' },
                                ...sortedActivePackages.map(p => ({ value: p.id, label: `${p.name} (${formatPrice(p.price)} TL)` }))
                            ]}
                        />
                        <TextField
                            id="assign-start"
                            label="Başlangıç Tarihi"
                            type="date"
                            value={assignedPackageStartDate}
                            onChange={(e) => setAssignedPackageStartDate(e.target.value)}
                        />
                        {assignError && <div className="text-red-500 text-xs">{assignError}</div>}
                        <Button fullWidth onClick={handleAssignPackage} loading={assigningPackage} disabled={!selectedPackageToAssign}>
                            <FiPlus /> Paket Ata
                        </Button>
                    </div>
                </div>

                {/* Payments Section */}
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Ödeme Geçmişi</h4>
                    {loadingPaymentHistory ? (
                        <div className="spinner"></div>
                    ) : paymentHistory.length > 0 ? (
                        <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                            {paymentHistory.map((p) => (
                                <li key={p.id} className="flex justify-between text-sm p-2 border-b last:border-0">
                                    <span className="text-gray-600">{formatDateToDDMMYY(p.date)}</span>
                                    <span className="font-medium text-gray-800">{formatPrice(p.amount)} TL</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 mb-4">Ödeme kaydı yok.</p>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <h5 className="text-sm font-semibold text-gray-700">Ödeme Ekle</h5>
                        <div className="grid grid-cols-2 gap-2">
                            <TextField
                                id="payment-amount"
                                label="Miktar"
                                type="number"
                                placeholder="TL"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                            <TextField
                                id="payment-date"
                                label="Tarih"
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                            />
                        </div>
                        {paymentError && <div className="text-red-500 text-xs">{paymentError}</div>}
                        <Button fullWidth onClick={handleRecordPayment} loading={recordingPayment} disabled={!paymentAmount}>
                            <FiPlus /> Ödeme Kaydet
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default MemberDetailModal;