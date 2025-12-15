// src/hooks/useMemberForm.ts
// Merkezi üye form yönetimi hook'u - DRY prensibi

import { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toJSDate } from '../utils/dateHelpers';
import { validators, ERROR_MESSAGES } from '../constants/validation';
import { generateYears, generateDays, TURKISH_MONTHS } from '../constants/dates';

// Form state tipi
export interface MemberFormState {
    name: string;
    surname: string;
    email: string;
    phone: string;
    birthDay: string;
    birthMonth: string;
    birthYear: string;
    parentName: string;
    parentPhone: string;
    notes: string;
}

// Initial empty state
const INITIAL_STATE: MemberFormState = {
    name: '',
    surname: '',
    email: '',
    phone: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    parentName: '',
    parentPhone: '',
    notes: '',
};

// Hook options
interface UseMemberFormOptions {
    editingMember?: {
        id?: string;
        name?: string;
        surname?: string;
        email?: string;
        phone?: string;
        birthDate?: Date | Timestamp | string | null;
        parentName?: string;
        parentPhone?: string;
        notes?: string;
    } | null;
    initialData?: Partial<MemberFormState> | null;
    onValidationError?: (message: string) => void;
}

export function useMemberForm(options: UseMemberFormOptions = {}) {
    const { editingMember, initialData, onValidationError } = options;

    const [formState, setFormState] = useState<MemberFormState>(INITIAL_STATE);
    const [errors, setErrors] = useState<Partial<Record<keyof MemberFormState, string>>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Formu doldur (editing veya initial data ile)
    useEffect(() => {
        const dataToFill = editingMember || initialData;

        if (dataToFill) {
            setFormState(prev => ({
                ...prev,
                name: dataToFill.name || '',
                surname: dataToFill.surname || '',
                email: dataToFill.email || '',
                phone: dataToFill.phone || '',
                parentName: dataToFill.parentName || '',
                parentPhone: dataToFill.parentPhone || '',
                notes: dataToFill.notes || '',
            }));

            // Doğum tarihi işleme
            if (editingMember?.birthDate) {
                const dateObj = toJSDate(editingMember.birthDate);
                if (dateObj) {
                    setFormState(prev => ({
                        ...prev,
                        birthDay: String(dateObj.getDate()),
                        birthMonth: String(dateObj.getMonth() + 1),
                        birthYear: String(dateObj.getFullYear()),
                    }));
                }
            }
        } else {
            setFormState(INITIAL_STATE);
        }
        setIsDirty(false);
    }, [editingMember, initialData]);

    // Ay/Yıl değiştiğinde gün sayısını ayarla
    useEffect(() => {
        if (!formState.birthMonth) return;

        const year = formState.birthYear ? parseInt(formState.birthYear, 10) : 2000;
        const month = parseInt(formState.birthMonth, 10);
        const daysInMonth = new Date(year, month, 0).getDate();

        if (formState.birthDay && parseInt(formState.birthDay, 10) > daysInMonth) {
            setFormState(prev => ({ ...prev, birthDay: String(daysInMonth) }));
        }
    }, [formState.birthMonth, formState.birthYear, formState.birthDay]);

    // 18 yaş altı kontrolü
    const isMinor = useCallback((): boolean => {
        const { birthDay, birthMonth, birthYear } = formState;
        if (!birthDay || !birthMonth || !birthYear) return false;

        const birthDate = new Date(
            Number(birthYear),
            Number(birthMonth) - 1,
            Number(birthDay)
        );
        return validators.isMinor(birthDate);
    }, [formState.birthDay, formState.birthMonth, formState.birthYear]);

    // Yaş hesapla
    const getAge = useCallback((): number | null => {
        const { birthDay, birthMonth, birthYear } = formState;
        if (!birthDay || !birthMonth || !birthYear) return null;

        const birthDate = new Date(
            Number(birthYear),
            Number(birthMonth) - 1,
            Number(birthDay)
        );
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }, [formState.birthDay, formState.birthMonth, formState.birthYear]);

    // Field değer güncelle
    const setField = useCallback(<K extends keyof MemberFormState>(
        field: K,
        value: MemberFormState[K]
    ) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        // Hata varsa temizle
        if (errors[field]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    }, [errors]);

    // Birden fazla field'ı güncelle
    const setFields = useCallback((updates: Partial<MemberFormState>) => {
        setFormState(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    }, []);

    // Form validasyonu
    const validate = useCallback((step?: number): boolean => {
        const newErrors: Partial<Record<keyof MemberFormState, string>> = {};
        const minor = isMinor();

        // Step 0 veya tüm form - Kişisel Bilgiler
        if (step === undefined || step === 0) {
            if (!formState.name.trim()) {
                newErrors.name = ERROR_MESSAGES.required;
            }
            if (!formState.surname.trim()) {
                newErrors.surname = ERROR_MESSAGES.required;
            }
            if (!formState.birthDay || !formState.birthMonth || !formState.birthYear) {
                newErrors.birthDay = 'Doğum tarihi zorunludur.';
            }
        }

        // Step 1 veya tüm form - İletişim Bilgileri
        if (step === undefined || step === 1) {
            if (!formState.email.trim()) {
                newErrors.email = ERROR_MESSAGES.required;
            } else if (!validators.isValidEmail(formState.email)) {
                newErrors.email = ERROR_MESSAGES.invalidEmail;
            }

            if (!formState.phone.trim()) {
                newErrors.phone = ERROR_MESSAGES.required;
            }

            // 18 yaş altı için veli bilgileri
            if (minor) {
                if (!formState.parentName.trim()) {
                    newErrors.parentName = ERROR_MESSAGES.parentRequired;
                }
                if (!formState.parentPhone.trim()) {
                    newErrors.parentPhone = ERROR_MESSAGES.parentRequired;
                }
            }
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            const firstError = Object.values(newErrors)[0];
            onValidationError?.(firstError);
            return false;
        }

        return true;
    }, [formState, isMinor, onValidationError]);

    // Doğum tarihini Date olarak al
    const getBirthDate = useCallback((): Date | null => {
        const { birthDay, birthMonth, birthYear } = formState;
        if (!birthDay || !birthMonth || !birthYear) return null;

        const date = new Date(
            Number(birthYear),
            Number(birthMonth) - 1,
            Number(birthDay)
        );
        return isNaN(date.getTime()) ? null : date;
    }, [formState.birthDay, formState.birthMonth, formState.birthYear]);

    // Firestore'a kaydedilecek data
    const getFormData = useCallback(() => {
        const birthDate = getBirthDate();
        const minor = isMinor();

        return {
            name: formState.name.trim(),
            surname: formState.surname.trim(),
            email: formState.email.trim() || null,
            phone: formState.phone.trim() || null,
            birthDate: birthDate ? Timestamp.fromDate(birthDate) : null,
            parentName: minor ? formState.parentName.trim() : null,
            parentPhone: minor ? formState.parentPhone.trim() : null,
            notes: formState.notes.trim() || null,
        };
    }, [formState, getBirthDate, isMinor]);

    // Formu sıfırla
    const reset = useCallback(() => {
        setFormState(INITIAL_STATE);
        setErrors({});
        setIsDirty(false);
    }, []);

    // Helper select options
    const yearOptions = generateYears();
    const dayOptions = generateDays(
        formState.birthYear ? parseInt(formState.birthYear, 10) : undefined,
        formState.birthMonth ? parseInt(formState.birthMonth, 10) : undefined
    );
    const monthOptions = TURKISH_MONTHS;

    return {
        // State
        formState,
        errors,
        isDirty,
        isEditing: !!editingMember,

        // Computed
        isMinor: isMinor(),
        age: getAge(),

        // Actions
        setField,
        setFields,
        validate,
        reset,
        getFormData,
        getBirthDate,

        // Options for selects
        yearOptions,
        dayOptions,
        monthOptions,
    };
}

export default useMemberForm;
