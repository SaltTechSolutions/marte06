// src/utils/dateHelpers.ts
// Timezone-aware date formatting utilities

export const TZ = 'Europe/Istanbul';

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);

export const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(date);

export const formatDayName = (date: Date) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, weekday: 'long' }).format(date);

export const formatDayMonth = (date: Date) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(date);

export const dateKeyTZ = (date: Date) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const sameDayTZ = (a: Date, b: Date) => dateKeyTZ(a) === dateKeyTZ(b);

export const hourTZ = (date: Date) =>
  parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(date), 10);

export const monthDayTZ = (date: Date) => {
  const parts = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, month: '2-digit', day: '2-digit' }).formatToParts(date);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '0', 10);
  const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '0', 10);
  return { month, day };
};

/**
 * Herhangi bir değeri Date'e dönüştürür
 * Firestore Timestamp, Date, string, number destekler
 */
export const toJSDate = (v: unknown): Date | null => {
  if (!v) return null;
  try {
    // Firestore Timestamp
    if (typeof (v as { toDate?: () => Date })?.toDate === 'function') {
      return (v as { toDate: () => Date }).toDate();
    }
    // Native Date
    if (v instanceof Date) return v;
    // String veya number
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch {
    // Ignore errors
  }
  return null;
};

/**
 * String formatındaki tarihi parse eder (YYYY-MM-DD)
 */
export const parseYMD = (str: string): Date | null => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if ([y, m, d].some(n => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d);
};

/**
 * Date'i YYYY-MM-DD formatına çevirir
 */
export const toYMD = (date: Date | null): string => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Calculate age from birthdate
export const calculateAge = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Check if birthday is today
export const isBirthdayToday = (birthDate: Date | null): boolean => {
  if (!birthDate) return false;
  const today = new Date();
  const { month: todayMonth, day: todayDay } = monthDayTZ(today);
  const { month: birthMonth, day: birthDay } = monthDayTZ(birthDate);
  return todayMonth === birthMonth && todayDay === birthDay;
};

// Check if birthday is within next N days
export const isBirthdaySoon = (birthDate: Date | null, days = 7): boolean => {
  if (!birthDate) return false;
  const today = new Date();
  const thisYear = today.getFullYear();

  // Bu yılki doğum günü
  const bdThisYear = new Date(thisYear, birthDate.getMonth(), birthDate.getDate());

  // Eğer geçtiyse, gelecek yılı kontrol et
  const bdToCheck = bdThisYear < today
    ? new Date(thisYear + 1, birthDate.getMonth(), birthDate.getDate())
    : bdThisYear;

  const diffMs = bdToCheck.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays <= days && diffDays > 0;
};

// Get date range for different view modes
export const getDateRange = (currentDate: Date, viewMode: 'day' | 'week' | 'month') => {
  if (viewMode === 'day') {
    const s = new Date(currentDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(currentDate);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }

  if (viewMode === 'week') {
    const s = new Date(currentDate);
    const dayOfWeek = s.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    s.setDate(s.getDate() + mondayOffset);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }

  // month
  const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  s.setHours(0, 0, 0, 0);
  const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  e.setHours(23, 59, 59, 999);
  return { start: s, end: e };
};

/**
 * İki tarih arasındaki gün farkını hesaplar
 */
export const daysBetween = (start: Date, end: Date): number => {
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Tarihi göreceli olarak gösterir (bugün, dün, 3 gün önce, vb.)
 */
export const formatRelative = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  if (diffDays === -1) return 'Yarın';
  if (diffDays < 0) return `${Math.abs(diffDays)} gün sonra`;
  if (diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
  return `${Math.floor(diffDays / 365)} yıl önce`;
};

