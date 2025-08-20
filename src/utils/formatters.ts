// src/utils/formatters.ts
import { Timestamp } from 'firebase/firestore';

const TZ = 'Europe/Istanbul';

// Formats a number as currency with thousands separators (Turkish Lira format)
export const formatPrice = (price: number): string => {
  if (isNaN(price) || price === null || price === undefined) {
    return '';
  }
  // Use Turkish locale for thousands separator (dot) and currency symbol (optional)
  return price.toLocaleString('tr-TR');
};

// Formats a Date or Timestamp object to dd/mm/yy string
export const formatDateToDDMMYY = (date: Date | Timestamp | null | undefined): string => {
  if (!date) return '';

  let jsDate: Date;
  if (date instanceof Timestamp) {
    jsDate = date.toDate();
  } else if (date instanceof Date) {
    jsDate = date;
  } else {
    return ''; // Handle other potential input types
  }

  const parts = new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).formatToParts(jsDate);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return `${day}/${month}/${year}`;
};

// Formats a Date or Timestamp object to yyyy-mm-dd string
export const formatDateToYYYYMMDD = (date: Date | Timestamp | null | undefined): string => {
  if (!date) return '';

  let jsDate: Date;
  if (date instanceof Timestamp) {
    jsDate = date.toDate();
  } else if (date instanceof Date) {
    jsDate = date;
  } else {
    return ''; // Handle other potential input types
  }

  const parts = new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(jsDate);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
};