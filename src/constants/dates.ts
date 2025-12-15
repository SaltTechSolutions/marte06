// src/constants/dates.ts
// Merkezi tarih sabitleri - DRY prensibi

export const TURKISH_MONTHS = [
    { value: 1, label: 'Ocak', short: 'Oca' },
    { value: 2, label: 'Şubat', short: 'Şub' },
    { value: 3, label: 'Mart', short: 'Mar' },
    { value: 4, label: 'Nisan', short: 'Nis' },
    { value: 5, label: 'Mayıs', short: 'May' },
    { value: 6, label: 'Haziran', short: 'Haz' },
    { value: 7, label: 'Temmuz', short: 'Tem' },
    { value: 8, label: 'Ağustos', short: 'Ağu' },
    { value: 9, label: 'Eylül', short: 'Eyl' },
    { value: 10, label: 'Ekim', short: 'Eki' },
    { value: 11, label: 'Kasım', short: 'Kas' },
    { value: 12, label: 'Aralık', short: 'Ara' },
] as const;

export const WEEKDAYS = [
    { value: 0, label: 'Pazar', short: 'Paz', letter: 'P' },
    { value: 1, label: 'Pazartesi', short: 'Pzt', letter: 'P' },
    { value: 2, label: 'Salı', short: 'Sal', letter: 'S' },
    { value: 3, label: 'Çarşamba', short: 'Çar', letter: 'Ç' },
    { value: 4, label: 'Perşembe', short: 'Per', letter: 'P' },
    { value: 5, label: 'Cuma', short: 'Cum', letter: 'C' },
    { value: 6, label: 'Cumartesi', short: 'Cmt', letter: 'C' },
] as const;

// Haftanın günleri (Pazartesi'den başlayarak, Türk takvim standardı)
export const WEEKDAYS_FROM_MONDAY = [
    { value: 1, label: 'Pazartesi', short: 'Pzt', letter: 'P' },
    { value: 2, label: 'Salı', short: 'Sal', letter: 'S' },
    { value: 3, label: 'Çarşamba', short: 'Çar', letter: 'Ç' },
    { value: 4, label: 'Perşembe', short: 'Per', letter: 'P' },
    { value: 5, label: 'Cuma', short: 'Cum', letter: 'C' },
    { value: 6, label: 'Cumartesi', short: 'Cmt', letter: 'C' },
    { value: 0, label: 'Pazar', short: 'Paz', letter: 'P' },
] as const;

// Renkli gün butonları için (Appointments.tsx'de kullanılıyor)
export const WEEKDAY_COLORS = [
    { d: 1, label: 'Pzt', inactiveBg: '#bfdbfe', inactiveText: '#0b3b8a', activeBg: '#2563eb', activeText: '#ffffff' },
    { d: 2, label: 'Sal', inactiveBg: '#c7d2fe', inactiveText: '#1e1b4b', activeBg: '#4f46e5', activeText: '#ffffff' },
    { d: 3, label: 'Çar', inactiveBg: '#e9d5ff', inactiveText: '#3b0764', activeBg: '#7c3aed', activeText: '#ffffff' },
    { d: 4, label: 'Per', inactiveBg: '#fbcfe8', inactiveText: '#831843', activeBg: '#db2777', activeText: '#ffffff' },
    { d: 5, label: 'Cum', inactiveBg: '#fde68a', inactiveText: '#78350f', activeBg: '#d97706', activeText: '#111827' },
    { d: 6, label: 'Cmt', inactiveBg: '#a7f3d0', inactiveText: '#064e3b', activeBg: '#10b981', activeText: '#064e3b' },
    { d: 0, label: 'Paz', inactiveBg: '#a5f3fc', inactiveText: '#083344', activeBg: '#06b6d4', activeText: '#083344' },
] as const;

// Çalışma saatleri (varsayılan)
export const WORKING_HOURS = {
    start: 6, // 06:00
    end: 23,  // 23:00
} as const;

// Ders süreleri (dakika)
export const LESSON_DURATIONS = [
    { value: 30, label: '30 dakika' },
    { value: 45, label: '45 dakika' },
    { value: 60, label: '1 saat' },
    { value: 90, label: '1.5 saat' },
    { value: 120, label: '2 saat' },
] as const;

// Yıl oluşturucu (doğum tarihi için)
export const generateYears = (range = 100): number[] => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: range }, (_, i) => currentYear - i);
};

// Gün oluşturucu (ay ve yıla göre)
export const generateDays = (year?: number, month?: number): number[] => {
    if (!month) {
        return Array.from({ length: 31 }, (_, i) => i + 1);
    }
    const y = year ?? 2000; // Leap year default for February
    const daysInMonth = new Date(y, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

// Saat slotları oluşturucu
export const generateTimeSlots = (
    startHour = WORKING_HOURS.start,
    endHour = WORKING_HOURS.end,
    intervalMinutes = 30
): string[] => {
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += intervalMinutes) {
            slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }
    return slots;
};

// Ay adını getir
export const getMonthLabel = (month: number, format: 'full' | 'short' = 'full'): string => {
    const m = TURKISH_MONTHS.find(m => m.value === month);
    return format === 'short' ? (m?.short ?? '') : (m?.label ?? '');
};

// Gün adını getir
export const getWeekdayLabel = (day: number, format: 'full' | 'short' | 'letter' = 'full'): string => {
    const d = WEEKDAYS.find(w => w.value === day);
    if (!d) return '';
    if (format === 'short') return d.short;
    if (format === 'letter') return d.letter;
    return d.label;
};
