
import React, { useState, useMemo, useEffect } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { db } from '../../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { calculateAge } from '../../../utils/dateHelpers';
import {
    Modal,
    Button,
    Input,
    ModalFooter,
} from '../../components';
import { FiChevronLeft, FiCheck, FiArrowRight } from 'react-icons/fi';

interface Package {
    id: string;
    name?: string;
    price?: number;
    lessonCount?: number;
    durationDays?: number;
    isActive?: boolean;
}

interface AddMemberWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

interface WizardData {
    name: string;
    phone: string;
    email: string;
    birthDate: string;
    notes: string;

    // Parent Info
    parentMode: 'new' | 'existing';
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    existingParentId: string;

    // Package Info
    selectedPackageId: string;
    packageStartDate: string;
}

const INITIAL_DATA: WizardData = {
    name: '',
    phone: '',
    email: '',
    birthDate: '',
    notes: '',
    parentMode: 'new',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    existingParentId: '',
    selectedPackageId: '',
    packageStartDate: new Date().toISOString().split('T')[0],
};

export const AddMemberWizard: React.FC<AddMemberWizardProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<WizardData>(INITIAL_DATA);
    const [loading, setLoading] = useState(false);

    // Fetch Packages for Step 3
    const { data: packages } = useFirestoreCollection('packages', [], { enabled: isOpen && step === 3 });
    // Fetch Members for Step 2 (Existing Parent)
    const { data: members } = useFirestoreCollection('members', [], { enabled: isOpen && step === 2 });

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setData(INITIAL_DATA);
        }
    }, [isOpen]);

    const isUnder18 = useMemo(() => {
        if (!data.birthDate) return false;
        const age = calculateAge(new Date(data.birthDate));
        return age !== null && age < 18;
    }, [data.birthDate]);

    const activePackages = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (packages as any[] || []).filter(p => p.isActive !== false).map(p => ({ id: p.id, ...p } as Package));
    }, [packages]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeMembers = useMemo(() => (members as any[] || []), [members]);

    const selectedPackage = useMemo(() => {
        return activePackages.find(p => p.id === data.selectedPackageId);
    }, [activePackages, data.selectedPackageId]);

    const handleNext = () => {
        if (step === 1) {
            if (!data.name || !data.phone) {
                alert('Ad Soyad ve Telefon zorunludur.');
                return;
            }
            if (isUnder18) {
                setStep(2);
            } else {
                setStep(3);
            }
        } else if (step === 2) {
            if (data.parentMode === 'new') {
                if (!data.parentName || !data.parentPhone) {
                    alert('Veli Adı ve Telefonu zorunludur.');
                    return;
                }
            } else {
                if (!data.existingParentId) {
                    alert('Lütfen bir veli seçin.');
                    return;
                }
            }
            setStep(3);
        }
    };

    const handleBack = () => {
        if (step === 3) {
            setStep(isUnder18 ? 2 : 1);
        } else if (step === 2) {
            setStep(1);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // 1. Create Member
            // Split name
            const parts = data.name.trim().split(' ');
            const surname = parts.length > 1 ? parts.pop() : '';
            const firstName = parts.join(' ');

            const memberData: any = {
                name: firstName,
                surname: surname,
                phone: data.phone,
                email: data.email,
                birthDate: data.birthDate ? new Date(data.birthDate) : null,
                notes: data.notes,
                isActive: true,
                createdAt: serverTimestamp(),
            };

            // Add Parent Info if under 18
            if (isUnder18) {
                if (data.parentMode === 'existing') {
                    memberData.parentId = data.existingParentId;
                } else {
                    memberData.parentInfo = {
                        name: data.parentName,
                        phone: data.parentPhone,
                        email: data.parentEmail
                    };
                }
            }

            const memberRef = await addDoc(collection(db, 'members'), memberData);
            const memberId = memberRef.id;

            // 2. Add Package if selected
            if (data.selectedPackageId && selectedPackage) {
                const startDate = new Date(data.packageStartDate);
                let endDate = null;

                if (selectedPackage.durationDays) {
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + Number(selectedPackage.durationDays));
                }

                await addDoc(collection(db, 'assigned_packages'), {
                    memberId: memberId,
                    packageId: data.selectedPackageId,
                    packageName: selectedPackage.name,
                    packagePrice: selectedPackage.price,
                    totalLessonCount: selectedPackage.lessonCount,
                    startDate: startDate,
                    endDate: endDate,
                    assignedAt: serverTimestamp(),
                });
            }

            onClose();
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <div className="space-y-4">
            <h4 className="font-semibold text-lg text-gray-800">Kişisel Bilgiler</h4>
            <Input
                label="Ad Soyad *"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="Ad Soyad"
            />
            <Input
                label="Telefon *"
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                placeholder="05..."
                type="tel"
            />
            <Input
                label="E-posta"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                placeholder="ornek@email.com"
                type="email"
            />
            <Input
                label="Doğum Tarihi"
                value={data.birthDate}
                onChange={(e: any) => setData({ ...data, birthDate: e.target.value })}
                type="date"
            />
            <Input
                label="Notlar"
                value={data.notes}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
                placeholder="Notlar..."
            />
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4">
            <h4 className="font-semibold text-lg text-gray-800">Veli Bilgileri (Kullanıcı 18 yaş altı)</h4>

            <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="radio"
                        name="parentMode"
                        checked={data.parentMode === 'new'}
                        onChange={() => setData({ ...data, parentMode: 'new' })}
                    />
                    <span className="text-sm font-medium">Yeni Veli</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="radio"
                        name="parentMode"
                        checked={data.parentMode === 'existing'}
                        onChange={() => setData({ ...data, parentMode: 'existing' })}
                    />
                    <span className="text-sm font-medium">Mevcut Üye</span>
                </label>
            </div>

            {data.parentMode === 'new' ? (
                <>
                    <Input
                        label="Veli Adı Soyadı *"
                        value={data.parentName}
                        onChange={(e) => setData({ ...data, parentName: e.target.value })}
                        placeholder="Veli Adı"
                    />
                    <Input
                        label="Veli Telefon *"
                        value={data.parentPhone}
                        onChange={(e) => setData({ ...data, parentPhone: e.target.value })}
                        placeholder="05..."
                        type="tel"
                    />
                    <Input
                        label="Veli E-posta"
                        value={data.parentEmail}
                        onChange={(e) => setData({ ...data, parentEmail: e.target.value })}
                        placeholder="veli@email.com"
                        type="email"
                    />
                </>
            ) : (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Veli Seçimi *</label>
                    <div className="relative">
                        <select
                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none appearance-none"
                            value={data.existingParentId}
                            onChange={(e) => setData({ ...data, existingParentId: e.target.value })}
                        >
                            <option value="">-- Üye Seçin --</option>
                            {activeMembers.map((m: any) => (
                                <option key={m.id} value={m.id}>
                                    {m.name} {m.surname} ({m.phone})
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            ▼
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4">
            <h4 className="font-semibold text-lg text-gray-800">Paket Seçimi (Opsiyonel)</h4>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Paket</label>
                <div className="relative">
                    <select
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none appearance-none"
                        value={data.selectedPackageId}
                        onChange={(e) => setData({ ...data, selectedPackageId: e.target.value })}
                    >
                        <option value="">-- Paket Seçimi Yok --</option>
                        {activePackages.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} - {p.price} TL
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                        ▼
                    </div>
                </div>
            </div>

            {data.selectedPackageId && selectedPackage && (
                <>
                    <Input
                        label="Başlangıç Tarihi"
                        value={data.packageStartDate}
                        onChange={(e: any) => setData({ ...data, packageStartDate: e.target.value })}
                        type="date"
                    />

                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <h5 className="font-medium text-indigo-900 mb-2">Paket Özeti</h5>
                        <div className="text-sm text-indigo-700 space-y-1">
                            <div className="flex justify-between">
                                <span>Paket:</span>
                                <span className="font-bold">{selectedPackage.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Ders Sayısı:</span>
                                <span>{selectedPackage.lessonCount || 'Sınırsız'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Süre:</span>
                                <span>{selectedPackage.durationDays || 'Süresiz'} Gün</span>
                            </div>
                            {selectedPackage.durationDays && (
                                <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1">
                                    <span>Tahmini Bitiş:</span>
                                    <span className="font-bold">
                                        {(() => {
                                            const d = new Date(data.packageStartDate);
                                            d.setDate(d.getDate() + Number(selectedPackage.durationDays));
                                            return d.toLocaleDateString('tr-TR');
                                        })()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Yeni Üye Ekle - Adım ${step}/3`}
            size="md"
        >
            <div className="mb-6">
                {/* Progress Indicators */}
                <div className="flex items-center justify-between mb-4 px-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`flex flex-col items-center flex-1 ${s === 2 && !isUnder18 ? 'opacity-30' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                                ${step === s ? 'border-indigo-600 bg-indigo-600 text-white' :
                                    step > s ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 text-gray-400'}
                             `}>
                                {step > s ? <FiCheck /> : s}
                            </div>
                            <span className="text-xs mt-1 text-gray-500 hidden sm:block">
                                {s === 1 ? 'Bilgiler' : s === 2 ? 'Veli Info' : 'Paket'}
                            </span>
                        </div>
                    ))}
                </div>

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </div>

            <ModalFooter className="wizard-footer-mobile-fix">
                <div className="flex justify-between w-full">
                    {step > 1 ? (
                        <Button variant="secondary" onClick={handleBack} leftIcon={<FiChevronLeft />}>
                            Geri
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={onClose}>
                            İptal
                        </Button>
                    )}

                    {step < 3 ? (
                        <Button variant="primary" onClick={handleNext} rightIcon={<FiArrowRight />}>
                            {step === 1 && !isUnder18 ? 'Paket Seçimine Git' : 'İleri'}
                        </Button>
                    ) : (
                        <Button variant="primary" onClick={handleSubmit} loading={loading} leftIcon={<FiCheck />}>
                            Kaydet
                        </Button>
                    )}
                </div>
            </ModalFooter>
        </Modal>
    );
};
