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

export const toJSDate = (v: any): Date | null => {
  if (!v) return null;
  try {
    if (typeof v?.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  } catch {}
  return null;
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
