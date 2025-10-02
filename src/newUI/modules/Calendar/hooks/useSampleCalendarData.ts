import { useMemo } from 'react';
import type {
  CalendarDay,
  CalendarLesson,
  CalendarOverview,
  CalendarParticipant,
} from '../types';

const now = new Date();

const createParticipants = (list: Array<{
  id: string;
  name: string;
  status: CalendarParticipant['status'];
  isWalkIn?: boolean;
}>): CalendarParticipant[] =>
  list.map((item) => ({ ...item }));

const sampleLessons: CalendarLesson[] = [
  {
    id: 'lesson-1',
    title: 'Vinyasa Yoga',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString(),
    members: 6,
    status: 'scheduled',
    participants: createParticipants([
      { id: 'mem-101', name: 'Elif Kaya', status: 'scheduled' },
      { id: 'mem-102', name: 'Mert Demir', status: 'scheduled' },
      { id: 'mem-103', name: 'Derya Şen', status: 'scheduled' },
      { id: 'mem-104', name: 'Selim Arı', status: 'scheduled' },
      { id: 'mem-105', name: 'Cansu Ak', status: 'scheduled' },
      { id: 'walk-1', name: 'Misafir Üye', status: 'scheduled', isWalkIn: true },
    ]),
  },
  {
    id: 'lesson-2',
    title: 'Pilates Reformer',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 30).toISOString(),
    members: 5,
    status: 'completed',
    participants: createParticipants([
      { id: 'mem-201', name: 'Aylin Uçar', status: 'attended' },
      { id: 'mem-202', name: 'Deniz Yıldız', status: 'attended' },
      { id: 'mem-203', name: 'Seda Alkan', status: 'absent' },
      { id: 'mem-204', name: 'Ferhat Kuzey', status: 'attended' },
      { id: 'mem-205', name: 'Aslı Turgut', status: 'attended' },
    ]),
  },
  {
    id: 'lesson-3',
    title: 'Fonksiyonel Antrenman',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 19, 0).toISOString(),
    members: 7,
    status: 'scheduled',
    participants: createParticipants([
      { id: 'mem-301', name: 'Tuna Arslan', status: 'scheduled' },
      { id: 'mem-302', name: 'Gamze Sel', status: 'scheduled' },
      { id: 'mem-303', name: 'Akın Ege', status: 'scheduled' },
      { id: 'mem-304', name: 'Sibel Akar', status: 'scheduled' },
      { id: 'mem-305', name: 'İpek Kurt', status: 'scheduled' },
      { id: 'mem-306', name: 'Tolga Biçer', status: 'scheduled' },
      { id: 'walk-2', name: 'Günlük Üye', status: 'scheduled', isWalkIn: true },
    ]),
  },
  {
    id: 'lesson-4',
    title: 'Mobility Clinic',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 19, 30).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 30).toISOString(),
    members: 4,
    status: 'cancelled',
    participants: createParticipants([
      { id: 'mem-401', name: 'Buse Aydın', status: 'scheduled' },
      { id: 'mem-402', name: 'Kerem Işık', status: 'scheduled' },
      { id: 'mem-403', name: 'Melisa Gül', status: 'scheduled' },
      { id: 'mem-404', name: 'Mehmet Yalın', status: 'scheduled' },
    ]),
    notes: 'Eğitmen rahatsızlığı nedeniyle ertelendi.',
  },
];

export const useSampleCalendarData = () => {
  const overview: CalendarOverview = useMemo(
    () => ({
      rangeLabel: 'Bu Hafta',
      totalLessons: sampleLessons.length,
      attendanceRate: 0.82,
      expiringPackages: 3,
    }),
    [],
  );

  const days: CalendarDay[] = useMemo(() => {
    const byDate = new Map<string, CalendarLesson[]>();
    sampleLessons.forEach((lesson) => {
      const dateKey = lesson.start.slice(0, 10);
      const bucket = byDate.get(dateKey) ?? [];
      bucket.push(lesson);
      byDate.set(dateKey, bucket);
    });
    return Array.from(byDate.entries()).map(([date, lessons]) => ({
      date,
      lessons: lessons.sort((a, b) => a.start.localeCompare(b.start)),
    }));
  }, []);

  return { overview, days };
};
