// src/components/MemberDetailModal.tsx
import React, { useState, useEffect } from 'react';
import type { Member } from './MemberList'; // Corrected import
import type { Package } from '../types/Package';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, Timestamp, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import './MemberDetailModal.css';
import { formatDateToDDMMYY, formatDateToYYYYMMDD, formatPrice } from '../utils/formatters';

// Interfaces defined inside the component file as they are specific to this modal
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
    onDelete: (memberId: string) => void; // Callback for deletion
    onMemberUpdate: (updatedMember: Member) => void; // Callback for when member details are updated
}

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ isVisible, onClose, member, onDelete, onMemberUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editableMember, setEditableMember] = useState<Member>(member);
    const [assignedPackages, setAssignedPackages] = useState<AssignedPackage[]>([]);
    const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
    const [loadingAssignedPackages, setLoadingAssignedPackages] = useState(false);
    const [loadingAvailablePackages, setLoadingAvailablePackages] = useState(false);
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

    // Helper: get editable birth date value for input (supports Timestamp | Date | string)
    const getBirthDateInputValue = (): string => {
        const bd: any = (editableMember as any).birthDate;
        if (!bd) return '';
        return typeof bd === 'string' ? bd : formatDateToYYYYMMDD(bd);
    };

    // Fetch assigned packages for the current member
    const fetchAssignedPackages = async () => {
        if (!member) return;
        setLoadingAssignedPackages(true);
        setFetchError(null);
        try {
            const q = query(collection(db, 'assigned_packages'), where('memberId', '==', member.id));
            const querySnapshot = await getDocs(q);
            const packages: AssignedPackage[] = [];
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                const packageDocRef = doc(db, 'packages', data.packageId);
                const packageDoc = await getDoc(packageDocRef);
                const packageName = packageDoc.exists() ? packageDoc.data().name : 'Bilinmeyen Paket';

                packages.push({
                    id: docSnap.id,
                    packageName,
                    ...data,
                    // Dummy values for calculated fields, implement calculation logic as needed
                    attendedLessons: 0,
                    calculatedRemainingLessons: data.totalLessonCount || 0,
                    outstandingBalance: data.packagePrice || 0,
                } as AssignedPackage);
            }
            setAssignedPackages(packages);
        } catch (error) {
            console.error('Error fetching assigned packages:', error);
            setFetchError('Atanmış paketler yüklenirken bir hata oluştu.');
        } finally {
            setLoadingAssignedPackages(false);
        }
    };

    // Fetch all available packages for assignment
    const fetchAvailablePackages = async () => {
        setLoadingAvailablePackages(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'packages'));
            const packages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
            setAvailablePackages(packages);
        } catch (error) {
            console.error('Error fetching available packages:', error);
            setFetchError('Mevcut paketler yüklenirken bir hata oluştu.');
        } finally {
            setLoadingAvailablePackages(false);
        }
    };

    // Fetch payment history for the current member
    const fetchPaymentHistory = async () => {
        if (!member) return;
        setLoadingPaymentHistory(true);
        try {
            const q = query(collection(db, 'payments'), where('memberId', '==', member.id));
            const querySnapshot = await getDocs(q);
            const payments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            setPaymentHistory(payments.sort((a, b) => b.date.toMillis() - a.date.toMillis())); // Sort by most recent
        } catch (error) {
            console.error('Error fetching payment history:', error);
            setFetchError('Ödeme geçmişi yüklenirken bir hata oluştu.');
        } finally {
            setLoadingPaymentHistory(false);
        }
    };

        

    // Reset state when modal is opened/closed or member changes
    useEffect(() => {
        if (isVisible) {
            setEditableMember(member);
            setIsEditing(false); // Always start in view mode
            fetchAssignedPackages();
            fetchAvailablePackages();
            fetchPaymentHistory();
        } else {
            // Clear states when modal is not visible
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
            // Robustly normalize birthDate
            const bd: any = (editableMember as any).birthDate;
            let normalizedBirthDate: Timestamp | null = null;
            if (bd) {
                if (typeof bd === 'string') {
                    const d = new Date(bd);
                    normalizedBirthDate = isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
                } else if (bd.toDate && typeof bd.toDate === 'function') {
                    // Firestore Timestamp duck-typing
                    normalizedBirthDate = bd as Timestamp;
                } else if (bd instanceof Date) {
                    normalizedBirthDate = Timestamp.fromDate(bd);
                }
            }

            const updatedData = {
                ...editableMember,
                birthDate: normalizedBirthDate,
            };
            await updateDoc(memberRef, updatedData);
            setIsEditing(false);
            onMemberUpdate({ ...editableMember, birthDate: normalizedBirthDate as any });
        } catch (error) {
            console.error('Error updating member:', error);
            // Optionally, show an error message to the user
        }
    };

    // Handle assigning a package to the member
    const handleAssignPackage = async () => {
        if (!selectedPackageToAssign || !assignedPackageStartDate) {
            setAssignError('Lütfen bir paket seçin ve başlangıç tarihi girin.');
            return;
        }
        setAssigningPackage(true);
        setAssignError(null);
        try {
            const selectedPackage = availablePackages.find(p => p.id === selectedPackageToAssign);
            if (!selectedPackage) {
                throw new Error('Seçilen paket bulunamadı.');
            }

            await addDoc(collection(db, 'assigned_packages'), {
                memberId: member.id,
                packageId: selectedPackageToAssign,
                startDate: Timestamp.fromDate(new Date(assignedPackageStartDate)),
                endDate: null, // or calculate based on package duration
                assignedAt: serverTimestamp(),
                totalLessonCount: selectedPackage.lessonCount || null,
                packagePrice: selectedPackage.price || null,
            });

            // Reset form and refresh assigned packages
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

    // Handle recording a new payment
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
                notes: '', // Optional: Add a notes field if needed
            });

            // Reset form and refresh payment history
            setPaymentAmount('');
            setPaymentDate(formatDateToYYYYMMDD(new Date()));
            fetchPaymentHistory();
            // Optionally, refresh assigned packages to update balance
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
                fetchAssignedPackages(); // Refresh the list
            } catch (error) {
                console.error('Error deleting assigned package:', error);
            }
        }
    };

    if (!isVisible) return null;

return (
    <div className="modal-overlay">
        <div className="modal-content">
            <div className="modal-header">
                <h2>{isEditing ? 'Üye Bilgilerini Düzenle' : 'Üye Detayları'}</h2>
            </div>

            <div className="member-details">
                {isEditing ? (
                    <>
                        <div className="form-group"><label>İsim:</label><input type="text" name="name" value={editableMember.name} onChange={handleInputChange} /></div>
                        <div className="form-group"><label>Telefon:</label><input type="text" name="phone" value={editableMember.phone} onChange={handleInputChange} /></div>
                        <div className="form-group"><label>E-posta:</label><input type="email" name="email" value={editableMember.email || ''} onChange={handleInputChange} /></div>
                        <div className="form-group"><label>Doğum Tarihi:</label><input type="date" name="birthDate" value={getBirthDateInputValue()} onChange={handleInputChange} /></div>
                        <div className="form-group"><label>Notlar:</label><textarea name="notes" value={editableMember.notes || ''} onChange={handleInputChange}></textarea></div>
                    </>
                ) : (
                    <>
                        <p><strong>İsim:</strong> {member.name}</p>
                        <p><strong>Telefon:</strong> {member.phone}</p>
                        <p><strong>E-posta:</strong> {member.email || 'N/A'}</p>
                        <p><strong>Doğum Tarihi:</strong> {member.birthDate ? formatDateToDDMMYY(member.birthDate) : 'N/A'}</p>
                        <p><strong>Notlar:</strong> {member.notes || 'N/A'}</p>
                    </>
                )}
            </div>

            <div className="assigned-packages">
                <h4>Atanmış Paketler</h4>
                {loadingAssignedPackages && <p>Yükleniyor...</p>}
                {!loadingAssignedPackages && fetchError && <p style={{ color: 'red' }}>{fetchError}</p>}
                {!loadingAssignedPackages && !fetchError && assignedPackages.length > 0 ? (
                    <ul>
                        {assignedPackages.map((pkg: AssignedPackage) => (
                            <li key={pkg.id}>
                                {pkg.packageName} ({formatDateToDDMMYY(pkg.startDate)}) - Kalan Ders: {pkg.calculatedRemainingLessons}
                                <button onClick={() => handleDeleteAssignedPackage(pkg.id)}>Sil</button>
                            </li>
                        ))}
                    </ul>
                ) : !loadingAssignedPackages && !fetchError && <p>Bu üyeye atanmış paket bulunmamaktadır.</p>}

                <div className="assign-package-controls">
                    <h5>Yeni Paket Ata</h5>
                    <select value={selectedPackageToAssign} onChange={(e) => setSelectedPackageToAssign(e.target.value)} disabled={loadingAvailablePackages}>
                        <option value="">-- Paket Seçin --</option>
                        {availablePackages.map((pkg: Package) => (
                            <option key={pkg.id} value={pkg.id}>{pkg.name} ({formatPrice(pkg.price)} TL)</option>
                        ))}
                    </select>
                    <input type="date" value={assignedPackageStartDate} onChange={(e) => setAssignedPackageStartDate(e.target.value)} />
                    {assignError && <p style={{ color: 'red' }}>{assignError}</p>}
                    <button onClick={handleAssignPackage} disabled={assigningPackage || !selectedPackageToAssign || !assignedPackageStartDate}>
                        {assigningPackage ? 'Atanıyor...' : 'Paket Ata'}
                    </button>
                </div>
            </div>

            <div className="payment-history">
                <h4>Ödeme Geçmişi</h4>
                {loadingPaymentHistory && <p>Ödeme geçmişi yükleniyor...</p>}
                {!loadingPaymentHistory && fetchError && <p style={{ color: 'red' }}>{fetchError}</p>}
                {!loadingPaymentHistory && !fetchError && paymentHistory.length > 0 ? (
                    <ul>
                        {paymentHistory.map((payment: Payment) => (
                            <li key={payment.id}>{formatDateToDDMMYY(payment.date)}: {formatPrice(payment.amount)} TL</li>
                        ))}
                    </ul>
                ) : !loadingPaymentHistory && !fetchError && <p>Bu üyeye ait ödeme kaydı bulunmamaktadır.</p>}

                <div className="record-payment-controls">
                    <h5>Yeni Ödeme Kaydet</h5>
                    <input type="number" placeholder="Miktar (TL)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required min="0" />
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                    {paymentError && <p style={{ color: 'red' }}>{paymentError}</p>}
                    <button onClick={handleRecordPayment} disabled={recordingPayment || paymentAmount === '' || Number(paymentAmount) <= 0 || !paymentDate}>
                        {recordingPayment ? 'Kaydediliyor...' : 'Ödeme Kaydet'}
                    </button>
                </div>
            </div>

            <div className="modal-main-actions">
                {isEditing ? (
                    <button onClick={handleUpdateMember} title="Kaydet">💾</button>
                ) : (
                    <button onClick={() => setIsEditing(true)} title="Düzenle">✏️</button>
                )}
                <button onClick={handleDeleteClick} title="Sil">🗑️</button>
                <button onClick={onClose} title="Kapat">❌</button>
            </div>
        </div>
    </div>
    );
};

export default MemberDetailModal;