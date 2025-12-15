// src/constants/validation.ts
// Validasyon kuralları ve regex pattern'leri

// Regex pattern'leri
export const PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^(\+90|0)?[0-9]{10}$/,
    turkishPhone: /^(05)[0-9]{9}$/,
    onlyNumbers: /^[0-9]+$/,
    onlyLetters: /^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/,
} as const;

// Input limitleri
export const INPUT_LIMITS = {
    name: { min: 2, max: 50 },
    surname: { min: 2, max: 50 },
    email: { min: 5, max: 100 },
    phone: { min: 10, max: 15 },
    notes: { max: 500 },
    packageName: { min: 2, max: 100 },
    packageDescription: { max: 300 },
} as const;

// Yaş sınırları
export const AGE_LIMITS = {
    minor: 18,
    senior: 65,
    minimum: 3,
    maximum: 120,
} as const;

// Ders limitleri
export const LESSON_LIMITS = {
    minPerPackage: 1,
    maxPerPackage: 100,
    maxPerDay: 10,
    maxMembersPerLesson: 20,
} as const;

// Paket limitleri
export const PACKAGE_LIMITS = {
    minPrice: 0,
    maxPrice: 100000,
    minDuration: 1,      // gün
    maxDuration: 365,    // gün
} as const;

// Hata mesajları
export const ERROR_MESSAGES = {
    required: 'Bu alan zorunludur.',
    invalidEmail: 'Geçerli bir e-posta adresi giriniz.',
    invalidPhone: 'Geçerli bir telefon numarası giriniz.',
    minLength: (min: number) => `En az ${min} karakter olmalıdır.`,
    maxLength: (max: number) => `En fazla ${max} karakter olabilir.`,
    minValue: (min: number) => `En az ${min} olmalıdır.`,
    maxValue: (max: number) => `En fazla ${max} olabilir.`,
    invalidDate: 'Geçerli bir tarih giriniz.',
    futureDate: 'Gelecek tarih seçilemez.',
    pastDate: 'Geçmiş tarih seçilemez.',
    parentRequired: '18 yaş altı üyeler için veli bilgileri zorunludur.',
    noPackageSelected: 'Lütfen bir paket seçiniz.',
    noMemberSelected: 'Lütfen bir üye seçiniz.',
    noDaySelected: 'Lütfen en az bir gün seçiniz.',
    genericError: 'Bir hata oluştu. Lütfen tekrar deneyiniz.',
} as const;

// Başarı mesajları
export const SUCCESS_MESSAGES = {
    memberAdded: 'Üye başarıyla eklendi.',
    memberUpdated: 'Üye başarıyla güncellendi.',
    memberDeleted: 'Üye başarıyla silindi.',
    packageAssigned: 'Paket başarıyla atandı.',
    packageDeleted: 'Paket başarıyla silindi.',
    paymentRecorded: 'Ödeme başarıyla kaydedildi.',
    lessonCreated: 'Ders başarıyla oluşturuldu.',
    lessonUpdated: 'Ders başarıyla güncellendi.',
    lessonDeleted: 'Ders başarıyla silindi.',
    appointmentsCreated: 'Randevular başarıyla oluşturuldu.',
    saved: 'Değişiklikler kaydedildi.',
} as const;

// Validasyon fonksiyonları
export const validators = {
    isValidEmail: (email: string): boolean => PATTERNS.email.test(email),
    isValidPhone: (phone: string): boolean => PATTERNS.turkishPhone.test(phone.replace(/\s/g, '')),
    isMinor: (birthDate: Date): boolean => {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age < AGE_LIMITS.minor;
    },
    isInRange: (value: number, min: number, max: number): boolean => value >= min && value <= max,
    isNotEmpty: (value: string | null | undefined): boolean => !!value && value.trim().length > 0,
};
