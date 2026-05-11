// src/components/MemberDetailModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { Member } from '../design-system/pages/MembersPage/MemberList';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, Timestamp, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getTypedData } from '../utils/firestoreHelpers';
import { formatDateToDDMMYY, formatDateToYYYYMMDD, formatPrice, toTurkishTitleCase } from '../utils/formatters';
import { useAuth } from '../utils/AuthContext';
import {
    Modal,
    ModalFooter,
    Button,
    Input,
    Select,
    Badge,
    Avatar
} from '../design-system/components';
import { FiTrash2, FiSave, FiEdit2, FiPlus, FiPhone, FiMail, FiCalendar, FiCreditCard, FiPackage } from 'react-icons/fi';

interface Package {
    id: string;
    name: string;
    price: number;
    lessonCount: number;
    durationDays?: number;
    isActive: boolean;
}

interface AssignedPackage {
    id: string;
    packageId: string;
    packageName: string;
    startDate: Timestamp;
    endDate: Timestamp | null;
    assignedAt: Timestamp;
    totalLessonCount?: number;
    packagePrice?: number;
    convertedPrice?: number;
    autoPaymentId?: string;
    attendedLessons: number;
    calculatedRemainingLessons: number;
    outstandingBalance: number;
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
    const [payments, setPayments] = useState<{ id: string; amount: number; date: Date; notes?: string }[]>([]);
    const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
    const [loadingAssignedPackages, setLoadingAssignedPackages] = useState(false);
    const [loadingPayments, setLoadingPayments] = useState(false);

    const [selectedPackageToAssign, setSelectedPackageToAssign] = useState<string>('');
    const [assignedPackageStartDate, setAssignedPackageStartDate] = useState<string>(formatDateToYYYYMMDD(new Date()));
    const [assigningPackage, setAssigningPackage] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(formatDateToYYYYMMDD(new Date()));
    const [recordingPayment, setRecordingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin';

    const getBirthDateInputValue = (): string => {
        const bd = editableMember.birthDate as unknown as string | Date | undefined;
        if (!bd) return '';
        return typeof bd === 'string' ? bd : formatDateToYYYYMMDD(bd);
    };

    const fetchAssignedPackages = async () => {
        if (!member) return;
        setLoadingAssignedPackages(true);
        try {
            // Fetch all packages once to avoid N+1 queries
            const allPackagesSnap = await getDocs(collection(db, 'packages'));
            const packageMap = new Map<string, string>();
            allPackagesSnap.forEach(doc => {
                packageMap.set(doc.id, getTypedData<{name?: string}>(doc).name || '');
            });

            const q = query(collection(db, 'assigned_packages'), where('memberId', '==', member.id));
            const querySnapshot = await getDocs(q);
            const basePackages: AssignedPackage[] = [];

            for (const docSnap of querySnapshot.docs) {
                const data = getTypedData<{
                    packageId: string;
                    startDate: any;
                    endDate?: any;
                    assignedAt: any;
                    totalLessonCount?: number;
                    packagePrice?: number;
                }>(docSnap);
                const packageName = packageMap.get(data.packageId) || 'Bilinmeyen Paket';

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
                    const raw = getTypedData<{ date?: Timestamp, attendedMemberIds?: string[] }>(d);
                    const ts = raw.date;
                    const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
                    const attendedIds = Array.isArray(raw.attendedMemberIds) ? raw.attendedMemberIds : [];
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
        } finally {
            setLoadingAssignedPackages(false);
        }
    };

    const fetchPayments = async () => {
        if (!member) return;
        setLoadingPayments(true);
        try {
            const q = query(collection(db, 'payments'), where('memberId', '==', member.id));
            const snap = await getDocs(q);
            const pList: { id: string; amount: number; date: Date; notes?: string }[] = [];
            snap.forEach(d => {
                const data = getTypedData<{ amount: number; date: Timestamp; notes?: string }>(d);
                if (data.date) {
                    pList.push({ id: d.id, amount: data.amount || 0, date: data.date.toDate(), notes: data.notes });
                }
            });
            pList.sort((a, b) => b.date.getTime() - a.date.getTime());
            setPayments(pList);
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setLoadingPayments(false);
        }
    };

    const fetchAvailablePackages = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'packages'));
            const packages = querySnapshot.docs.map(doc => getTypedData<{ id: string } & Package>(doc));
            setAvailablePackages(packages as Package[]);
        } catch (error) {
            console.error('Error fetching available packages:', error);
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
            fetchPayments();
            fetchAvailablePackages();
        } else {
            setAssignedPackages([]);
            setPayments([]);
            setAvailablePackages([]);

            setAssignError(null);
            setPaymentError(null);
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
                packageName: selectedPackage.name,
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
            fetchPayments();
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

    const handleDeletePayment = async (paymentId: string) => {
        if (window.confirm('Bu ödemeyi silmek istediğinizden emin misiniz?')) {
            try {
                await deleteDoc(doc(db, 'payments', paymentId));
                fetchPayments();
            } catch (error) {
                console.error('Error deleting payment:', error);
            }
        }
    };

    const fullName = `${member.name} ${member.surname}`;
    const totalDebt = assignedPackages.reduce((sum, pkg) => sum + (pkg.packagePrice || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const outstandingBalance = totalDebt - totalPaid;

    return (
        <Modal
            isOpen={isVisible}
            onClose={onClose}
            title={isEditing ? 'Bilgileri Düzenle' : undefined}
            variant="bottom-sheet"
        >
            <div className="flex flex-col h-full bg-white overflow-hidden">
                {!isEditing && (
                    <div className="flex items-center p-4 border-b border-gray-100">
                        <Avatar name={fullName} size="lg" className="mr-4" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                            <Badge variant={member.isActive ? 'success' : 'default'} size="sm">
                                {member.isActive ? 'Aktif Üye' : 'Pasif Üye'}
                            </Badge>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Member Info Section */}
                    {isEditing ? (
                        <div className="space-y-4">
                            <Input label="İsim" name="name" value={editableMember.name} onChange={handleInputChange} fullWidth />
                            <Input label="Soyisim" name="surname" value={editableMember.surname} onChange={handleInputChange} fullWidth />
                            <Input label="Telefon" name="phone" value={editableMember.phone} onChange={handleInputChange} fullWidth />
                            <Input label="E-posta" name="email" type="email" value={editableMember.email || ''} onChange={handleInputChange} fullWidth />
                            <Input label="Doğum Tarihi" name="birthDate" type="date" value={getBirthDateInputValue()} onChange={handleInputChange} fullWidth />
                            <Input label="Notlar" name="notes" value={editableMember.notes || ''} onChange={handleInputChange} fullWidth />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 text-sm">
                            <div className="flex items-center text-gray-600">
                                <FiPhone className="mr-3 text-ds-primary-500" size={18} />
                                <span>{member.phone || '-'}</span>
                            </div>
                            <div className="flex items-center text-gray-600">
                                <FiMail className="mr-3 text-ds-primary-500" size={18} />
                                <span>{member.email || '-'}</span>
                            </div>
                            <div className="flex items-center text-gray-600">
                                <FiCalendar className="mr-3 text-ds-primary-500" size={18} />
                                <span>{member.birthDate ? formatDateToDDMMYY(member.birthDate as any) : '-'}</span>
                            </div>
                            {member.notes && (
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-700 italic">
                                    "{member.notes}"
                                </div>
                            )}
                            {isAdmin && (
                                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                                    <div className="flex justify-between"><span>Kullanıcı Adı:</span> <span className="font-mono">{member.email || '-'}</span></div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Packages Section */}
                    <div className="space-y-3">
                        <h4 className="flex items-center text-lg font-semibold text-gray-800">
                            <FiPackage className="mr-2" /> Paketler
                        </h4>

                        {loadingAssignedPackages && <div className="text-gray-500 text-sm">Yükleniyor...</div>}
                        {!loadingAssignedPackages && assignedPackages.length === 0 && (
                            <div className="text-gray-500 text-sm italic">Aktif paket bulunamadı.</div>
                        )}

                        <div className="space-y-2">
                            {assignedPackages.map((pkg) => (
                                <div key={pkg.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                                    <div>
                                        <div className="font-medium text-gray-900">{pkg.packageName}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {formatDateToDDMMYY(pkg.startDate)} • Kalan: <span className="font-bold text-ds-primary-600">{pkg.calculatedRemainingLessons}</span>
                                        </div>
                                    </div>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteAssignedPackage(pkg.id)}><FiTrash2 /></Button>
                                </div>
                            ))}
                        </div>

                        {/* Add Package Form */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-3">
                            <h5 className="text-sm font-semibold text-gray-700">Yeni Paket Ata</h5>
                            <Select
                                options={[
                                    { value: '', label: '-- Paket Seçin --' },
                                    ...sortedActivePackages.map(p => ({ value: p.id, label: `${p.name} (${formatPrice(p.price)} TL)` }))
                                ]}
                                value={selectedPackageToAssign}
                                onChange={(e) => setSelectedPackageToAssign(e.target.value)}
                                fullWidth
                            />
                            <Input
                                type="date"
                                value={assignedPackageStartDate}
                                onChange={(e) => setAssignedPackageStartDate(e.target.value)}
                                fullWidth
                            />
                            {assignError && <div className="text-red-500 text-xs">{assignError}</div>}
                            <Button variant="secondary" fullWidth onClick={handleAssignPackage} loading={assigningPackage} disabled={!selectedPackageToAssign} leftIcon={<FiPlus />}>
                                Paket Ata
                            </Button>
                        </div>
                    </div>

                    {/* Payments Section */}
                    <div className="space-y-3 pb-safe">
                        <div className="flex items-center justify-between">
                            <h4 className="flex items-center text-lg font-semibold text-gray-800">
                                <FiCreditCard className="mr-2" /> Ödemeler
                            </h4>
                            <div className="text-right">
                                <div className="text-xs text-gray-500">Kalan Borç</div>
                                <div className={`font-bold ${outstandingBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {formatPrice(outstandingBalance)} TL
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-gray-50 p-2">
                                <div className="text-xs text-gray-500">Paket Tutarı</div>
                                <div className="font-semibold text-gray-900">{formatPrice(totalDebt)} TL</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-2">
                                <div className="text-xs text-gray-500">Ödenen</div>
                                <div className="font-semibold text-green-600">{formatPrice(totalPaid)} TL</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-2">
                                <div className="text-xs text-gray-500">Durum</div>
                                <div className={`font-semibold ${outstandingBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {outstandingBalance > 0 ? 'Borçlu' : 'Tamam'}
                                </div>
                            </div>
                        </div>

                        {loadingPayments && <div className="text-gray-500 text-sm">Ödemeler yükleniyor...</div>}
                        {!loadingPayments && payments.length === 0 && (
                            <div className="text-gray-500 text-sm italic">Henüz ödeme kaydı bulunmuyor.</div>
                        )}

                        <div className="space-y-2">
                            {payments.map((payment) => (
                                <div key={payment.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                                    <div>
                                        <div className="font-bold text-green-600">+{formatPrice(payment.amount)} TL</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {formatDateToDDMMYY(payment.date)} {payment.notes && `• ${payment.notes}`}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(payment.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50"><FiTrash2 /></Button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-3">
                            <h5 className="text-sm font-semibold text-gray-700">Ödeme Ekle</h5>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Tutar"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="flex-1"
                                />
                                <Input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                            {paymentError && <div className="text-red-500 text-xs">{paymentError}</div>}
                            <Button variant="secondary" fullWidth onClick={handleRecordPayment} loading={recordingPayment} disabled={!paymentAmount} leftIcon={<FiPlus />}>
                                Ödeme Kaydet
                            </Button>
                        </div>
                    </div>
                </div>

                <ModalFooter className="border-t border-gray-100 bg-white">
                    <div className="flex gap-3 w-full">
                        {isEditing ? (
                            <>
                                <Button variant="ghost" onClick={() => setIsEditing(false)} className="flex-1">İptal</Button>
                                <Button variant="primary" onClick={handleUpdateMember} className="flex-1" leftIcon={<FiSave />}>Kaydet</Button>
                            </>
                        ) : (
                            <>
                                <Button variant="danger" onClick={handleDeleteClick}><FiTrash2 /></Button>
                                <Button variant="secondary" onClick={onClose} className="flex-1">Kapat</Button>
                                <Button variant="primary" onClick={() => setIsEditing(true)} className="flex-1" leftIcon={<FiEdit2 />}>Düzenle</Button>
                            </>
                        )}
                    </div>
                </ModalFooter>
            </div>
        </Modal>
    );
};

export default MemberDetailModal;
