// src/components/AddMemberForm.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import type { Member } from '../components/MemberList';
import { Timestamp } from 'firebase/firestore'; // Timestamp import eklendi
import { TextField, Button, Stack, Typography, MenuItem, Alert } from '@mui/material';

interface InitialMemberData {
    id?: string;
    name?: string;
    surname?: string;
    birthDate?: string | Date | Timestamp;
    phone?: string;
    email?: string;
    address?: string;
    healthIssues?: string;
    medications?: string;
    injuries?: string;
    packageChoice?: string;
    otherPackageDetail?: string;
    parentName?: string;
    parentPhone?: string;
    notes?: string;
}

interface AddMemberFormProps {
    onMemberAdded: () => void;
    onMemberUpdated?: () => void;
    editingMember?: Member | null;
    initialData?: InitialMemberData | null;
    onCancel?: () => void;
}

const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 100; i--) {
        years.push(i);
    }
    return years;
};

const generateDays = (year: string | '', month: string | '') => {
    if (year === '' || month === '') return [];
    const y = parseInt(year as string, 10);
    const m = parseInt(month as string, 10);
    const date = new Date(y, m, 0);
    const daysInMonth = date.getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }
    return days;
};

const AddMemberForm: React.FC<AddMemberFormProps> = ({ onMemberAdded, onMemberUpdated, editingMember, initialData, onCancel }) => {
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDay, setBirthDay] = useState<string>('');
    const [birthMonth, setBirthMonth] = useState<string>('');
    const [birthYear, setBirthYear] = useState<string>('');
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const dataToFill = editingMember || initialData;

        if (dataToFill) {
            setName(dataToFill.name || '');
            setSurname(dataToFill.surname || '');
            setEmail(dataToFill.email || '');
            setPhone(dataToFill.phone || '');

            if (dataToFill.birthDate) {
                let dateObj: Date | null = null;
                if (dataToFill.birthDate instanceof Timestamp) {
                    dateObj = dataToFill.birthDate.toDate();
                } else if (dataToFill.birthDate instanceof Date) {
                    dateObj = dataToFill.birthDate;
                } else if (typeof dataToFill.birthDate === 'string') {
                    try {
                        const parts = dataToFill.birthDate.split('-');
                        if (parts.length === 3) {
                            dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        } else {
                            console.warn('Invalid birth date format:', dataToFill.birthDate);
                        }
                    } catch (e) {
                        console.error('Birth date parse error:', e);
                    }
                }

                if (dateObj && !isNaN(dateObj.getTime())) {
                    setBirthDay(String(dateObj.getDate()));
                    setBirthMonth(String(dateObj.getMonth() + 1));
                    setBirthYear(String(dateObj.getFullYear()));
                } else {
                    console.warn('Invalid birth date:', dataToFill.birthDate);
                    setBirthDay('');
                    setBirthMonth('');
                    setBirthYear('');
                }
            } else {
                setBirthDay('');
                setBirthMonth('');
                setBirthYear('');
            }

            setParentName(dataToFill.parentName || '');
            setParentPhone(dataToFill.parentPhone || '');
            setNotes(dataToFill.notes || '');
        } else {
            setName('');
            setSurname('');
            setEmail('');
            setPhone('');
            setBirthDay('');
            setBirthMonth('');
            setBirthYear('');
            setParentName('');
            setParentPhone('');
            setNotes('');
        }
    }, [initialData, editingMember]);

    const isMinor = (() => {
        if (birthDay === '' || birthMonth === '' || birthYear === '') return false;
        const today = new Date();
        const birthDate = new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age < 18;
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (birthDay === '' || birthMonth === '' || birthYear === '') {
            if (!(editingMember?.birthDate || initialData?.birthDate)) {
                setError('Please enter the full birth date (Day, Month, Year).');
                setLoading(false);
                return;
            }
        }

        if (isMinor && (!parentName || !parentPhone)) {
            setError('Parent name and phone are required for members under 18.');
            setLoading(false);
            return;
        }

        let birthDateObj: Date | null = null;
        if (birthDay !== '' && birthMonth !== '' && birthYear !== '') {
            birthDateObj = new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));
            if (isNaN(birthDateObj.getTime())) {
                setError('Invalid birth date entered.');
                setLoading(false);
                return;
            }
        }

        try {
            const memberDataToSave = {
                name,
                surname,
                email,
                phone,
                birthDate: birthDateObj,
                parentName: isMinor ? parentName : null,
                parentPhone: isMinor ? parentPhone : null,
                notes,
            };

            if (editingMember) {
                const memberRef = doc(db, 'members', editingMember.id);
                await updateDoc(memberRef, {
                    ...memberDataToSave,
                    updatedAt: Timestamp.now(),
                });
                console.log('Member updated, Document ID:', editingMember.id);
                onMemberUpdated?.();
            } else {
                const docRef = await addDoc(collection(db, 'members'), {
                    ...memberDataToSave,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                console.log('New member added, Document ID:', docRef.id);
                onMemberAdded();
            }

            setName('');
            setSurname('');
            setEmail('');
            setPhone('');
            setBirthDay('');
            setBirthMonth('');
            setBirthYear('');
            setParentName('');
            setParentPhone('');
            setNotes('');
        } catch (error: any) {
            console.error(editingMember ? 'Member update error:' : 'Member add error:', error);
            setError(editingMember ? `Error updating member: ${error.message}` : `Error adding member: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const years = generateYears();
    const days = generateDays(birthYear, birthMonth);
    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' },
    ];

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {editingMember ? 'Üye Düzenle' : initialData ? 'Taranan Veriden Üye Ekle' : 'Yeni Üye Ekle'}
                </Typography>
                {error && <Alert severity="error">{error}</Alert>}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField fullWidth label="İsim" value={name} onChange={(e) => setName(e.target.value)} required />
                    <TextField fullWidth label="Soyisim" value={surname} onChange={(e) => setSurname(e.target.value)} required />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField fullWidth type="email" label="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <TextField fullWidth type="tel" label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Stack>

                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>Doğum Tarihi</Typography>
                <Stack direction="row" spacing={1}>
                    <TextField select label="Gün" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} required sx={{ minWidth: 100 }}>
                        <MenuItem value=""><em>Gün</em></MenuItem>
                        {days.map((d) => (
                            <MenuItem key={d} value={String(d)}>{d}</MenuItem>
                        ))}
                    </TextField>
                    <TextField select label="Ay" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required sx={{ minWidth: 120 }}>
                        <MenuItem value=""><em>Ay</em></MenuItem>
                        {months.map((m) => (
                            <MenuItem key={m.value} value={String(m.value)}>{m.label}</MenuItem>
                        ))}
                    </TextField>
                    <TextField select label="Yıl" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} required sx={{ minWidth: 120 }}>
                        <MenuItem value=""><em>Yıl</em></MenuItem>
                        {years.map((y) => (
                            <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                        ))}
                    </TextField>
                </Stack>

                <TextField label="Notlar" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={3} />

                {isMinor && (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="subtitle2">Veli Bilgileri (18 yaş altı için zorunlu)</Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField fullWidth label="Veli Adı" value={parentName} onChange={(e) => setParentName(e.target.value)} required />
                            <TextField fullWidth label="Veli Telefon" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} required />
                        </Stack>
                    </Stack>
                )}

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {typeof onCancel === 'function' && (
                        <Button variant="text" onClick={onCancel} disabled={loading}>İptal</Button>
                    )}
                    <Button type="submit" variant="contained" disabled={loading}>
                        {loading ? (editingMember ? 'Güncelleniyor...' : 'Ekleniyor...') : editingMember ? 'Güncelle' : 'Kaydet'}
                    </Button>
                </Stack>
            </Stack>
        </form>
    );
};

export default AddMemberForm;