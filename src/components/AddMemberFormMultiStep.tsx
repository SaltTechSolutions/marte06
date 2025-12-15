// src/components/AddMemberFormMultiStep.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import type { Member } from './MemberList';
import { toTurkishTitleCase } from '../utils/formatters';
import MultiStepForm from './MultiStepForm';
import { useToast } from './ToastContext';
import { TextField, SelectField } from '../newUI/primitives'; // UI Primitives import
import './AddMemberForm.css';

interface AddMemberFormMultiStepProps {
  onMemberAdded: () => void;
  onMemberUpdated?: () => void;
  editingMember?: Member | null;
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
  if (month === '') {
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }
  const y = year === '' ? 2000 : parseInt(year as string, 10);
  const m = parseInt(month as string, 10);
  const daysInMonth = new Date(y, m, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

const AddMemberFormMultiStep = ({
  onMemberAdded,
  onMemberUpdated,
  editingMember,
  onCancel
}: AddMemberFormMultiStepProps) => {
  const { showSuccess, showError } = useToast();
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
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

  // Load editing member data
  useEffect(() => {
    if (editingMember) {
      setName(editingMember.name || '');
      setSurname(editingMember.surname || '');
      setEmail(editingMember.email || '');
      setPhone(editingMember.phone || '');

      if (editingMember.birthDate) {
        let dateObj: Date | null = null;
        const bd = editingMember.birthDate as any;

        if (bd && typeof bd.toDate === 'function') {
          // Firestore Timestamp
          dateObj = bd.toDate();
        } else if (bd instanceof Date) {
          dateObj = bd;
        } else if (typeof bd === 'string') {
          try {
            const parts = bd.split('-');
            if (parts.length === 3) {
              dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
          } catch (e) {
            console.error('Birth date parse error:', e);
          }
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
          setBirthDay(String(dateObj.getDate()));
          setBirthMonth(String(dateObj.getMonth() + 1));
          setBirthYear(String(dateObj.getFullYear()));
        }
      }

      setParentName(editingMember.parentName || '');
      setParentPhone(editingMember.parentPhone || '');
      setNotes(editingMember.notes || '');
    }
  }, [editingMember]);

  // Auto-adjust day if month/year changes
  useEffect(() => {
    if (birthMonth === '') return;
    const y = birthYear === '' ? 2000 : parseInt(birthYear, 10);
    const m = parseInt(birthMonth, 10);
    const dim = new Date(y, m, 0).getDate();
    if (birthDay !== '' && parseInt(birthDay, 10) > dim) {
      setBirthDay(String(dim));
    }
  }, [birthMonth, birthYear, birthDay]);

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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Personal Info
        if (!name.trim()) {
          showError('Ad alanı zorunludur.');
          return false;
        }
        if (!surname.trim()) {
          showError('Soyad alanı zorunludur.');
          return false;
        }
        if (!birthDay || !birthMonth || !birthYear) {
          showError('Doğum tarihi zorunludur.');
          return false;
        }
        return true;

      case 1: // Contact Info
        if (!email.trim()) {
          showError('E-posta alanı zorunludur.');
          return false;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          showError('Geçerli bir e-posta adresi giriniz.');
          return false;
        }
        if (!phone.trim()) {
          showError('Telefon alanı zorunludur.');
          return false;
        }
        if (isMinor && !parentName.trim()) {
          showError('18 yaş altı üyeler için veli adı zorunludur.');
          return false;
        }
        if (isMinor && !parentPhone.trim()) {
          showError('18 yaş altı üyeler için veli telefonu zorunludur.');
          return false;
        }
        return true;

      case 2: // Additional Info
        return true;

      default:
        return true;
    }
  };

  // Check if a step has validation errors
  const getStepValidationStatus = (step: number): 'valid' | 'invalid' | 'untouched' => {
    switch (step) {
      case 0:
        if (!name.trim() || !surname.trim() || !birthDay || !birthMonth || !birthYear) {
          return currentStep > 0 ? 'invalid' : 'untouched';
        }
        return 'valid';

      case 1:
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim() || !emailRegex.test(email.trim()) || !phone.trim()) {
          return currentStep > 1 ? 'invalid' : 'untouched';
        }
        if (isMinor && (!parentName.trim() || !parentPhone.trim())) {
          return currentStep > 1 ? 'invalid' : 'untouched';
        }
        return 'valid';

      case 2:
        return 'valid';

      default:
        return 'untouched';
    }
  };

  const handleSubmit = async () => {
    // Final validation before submit
    if (!validateStep(0) || !validateStep(1)) {
      return;
    }

    setLoading(true);

    try {
      let birthDate: Timestamp | null = null;
      if (birthDay && birthMonth && birthYear) {
        const bd = new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));
        if (!isNaN(bd.getTime())) {
          birthDate = Timestamp.fromDate(bd);
        }
      }

      const memberData = {
        name: toTurkishTitleCase(name.trim()),
        surname: toTurkishTitleCase(surname.trim()),
        email: email.trim() || null,
        phone: phone.trim() || null,
        birthDate,
        parentName: isMinor ? toTurkishTitleCase(parentName.trim()) : null,
        parentPhone: isMinor ? parentPhone.trim() : null,
        notes: notes.trim() || null,
        isActive: true,
      };

      if (editingMember) {
        const memberRef = doc(db, 'members', editingMember.id);
        await updateDoc(memberRef, { ...memberData, updatedAt: Timestamp.now() });
        showSuccess('Üye başarıyla güncellendi!');
        onMemberUpdated?.();
      } else {
        await addDoc(collection(db, 'members'), {
          ...memberData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        showSuccess('Üye başarıyla eklendi!');
        onMemberAdded();
      }

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error saving member:', error);
      showError('Üye kaydedilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
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
    setCurrentStep(0);
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  // Step 1: Personal Information
  const Step1PersonalInfo = (
    <div className="form-step">
      <h3 className="step-heading">Kişisel Bilgiler</h3>

      <TextField
        id="name"
        label="Ad"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Üyenin adı"
        className="mb-3"
      />

      <TextField
        id="surname"
        label="Soyad"
        value={surname}
        onChange={(e) => setSurname(e.target.value)}
        required
        placeholder="Üyenin soyadı"
        className="mb-3"
      />

      <div className="form-group">
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--muted-color)' }}>Doğum Tarihi *</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <SelectField
            value={birthDay}
            onChange={(e) => setBirthDay(e.target.value)}
            required
            options={generateDays(birthYear, birthMonth).map(d => ({ value: String(d), label: d }))}
            placeholder="Gün"
          />

          <SelectField
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            required
            options={Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ value: String(m), label: m }))}
            placeholder="Ay"
          />

          <SelectField
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            required
            options={generateYears().map(y => ({ value: String(y), label: y }))}
            placeholder="Yıl"
          />
        </div>
        {isMinor && (
          <p className="field-hint" style={{ color: 'var(--color-warning, orange)', marginTop: '0.5rem' }}>
            ⚠️ 18 yaş altı - Veli bilgileri gereklidir
          </p>
        )}
      </div>
    </div>
  );

  // Step 2: Contact Information
  const Step2ContactInfo = (
    <div className="form-step">
      <h3 className="step-heading">İletişim Bilgileri</h3>

      <TextField
        id="email"
        type="email"
        label="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ornek@email.com"
        required
        className="mb-3"
      />

      <TextField
        id="phone"
        type="tel"
        label="Telefon"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="05XX XXX XX XX"
        required
        className="mb-3"
      />

      {isMinor && (
        <>
          <TextField
            id="parentName"
            label="Veli Adı Soyadı"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            required
            placeholder="Veli adı soyadı"
            className="mb-3"
          />

          <TextField
            id="parentPhone"
            type="tel"
            label="Veli Telefonu"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            required
            placeholder="05XX XXX XX XX"
            className="mb-3"
          />
        </>
      )}
    </div>
  );

  // Step 3: Additional Information
  const Step3AdditionalInfo = (
    <div className="form-step">
      <h3 className="step-heading">Ek Bilgiler</h3>

      <div className="form-group">
        <label htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--muted-color)' }}>Notlar</label>
        <textarea
          id="notes"
          className="input" // Using standard input class for textarea as TextField doesn't support multiline yet or I missed it
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="Sağlık durumu, ilaçlar, sakatlıklar veya diğer önemli notlar..."
          style={{ width: '100%', padding: '0.75em', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
        />
        <p className="field-hint" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--muted-color)' }}>
          Sağlık sorunları, kullanılan ilaçlar, sakatlıklar veya dikkat edilmesi gereken durumlar
        </p>
      </div>

      <div className="form-summary" style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Özet</h4>
        <p><strong>Ad Soyad:</strong> {name} {surname}</p>
        {birthDay && birthMonth && birthYear && (
          <p><strong>Doğum Tarihi:</strong> {birthDay}/{birthMonth}/{birthYear}</p>
        )}
        {email && <p><strong>E-posta:</strong> {email}</p>}
        {phone && <p><strong>Telefon:</strong> {phone}</p>}
        {isMinor && parentName && (
          <p><strong>Veli:</strong> {parentName} - {parentPhone}</p>
        )}
      </div>
    </div>
  );

  const steps = [
    { title: 'Kişisel Bilgiler', component: Step1PersonalInfo },
    { title: 'İletişim', component: Step2ContactInfo },
    { title: 'Ek Bilgiler', component: Step3AdditionalInfo },
  ];

  return (
    <div className="add-member-form-multi-step">
      <h2 style={{ marginBottom: '1.5rem' }}>{editingMember ? 'Üye Düzenle' : 'Yeni Üye Ekle'}</h2>

      <MultiStepForm
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onComplete={handleSubmit}
        onCancel={handleCancel}
        validateStep={validateStep}
        getStepValidationStatus={getStepValidationStatus}
      />

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Kaydediliyor...</p>
        </div>
      )}
    </div>
  );
};

export default AddMemberFormMultiStep;
