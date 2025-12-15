import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { useMembers } from '../../../../hooks/useMembers';
import { dateKeyTZ, TZ } from '../../../../utils/dateHelpers';
import type { CalendarDay, CalendarLesson, CalendarOverview, CalendarParticipant } from '../types';

export type CalendarViewMode = 'day' | 'week';

export type UseFirestoreCalendarOptions = {
  currentDate: Date;
  viewMode: CalendarViewMode;
};

export type UseFirestoreCalendarResult = {
  days: CalendarDay[];
  overview: CalendarOverview;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const DEFAULT_OVERVIEW: CalendarOverview = {
  rangeLabel: '',
  totalLessons: 0,
  attendanceRate: 0,
  expiringPackages: 0,
};

const getRange = (currentDate: Date, viewMode: CalendarViewMode) => {
  if (viewMode === 'day') {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const base = new Date(currentDate);
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const start = new Date(base);
  start.setDate(base.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const useFirestoreCalendar = ({ currentDate, viewMode }: UseFirestoreCalendarOptions): UseFirestoreCalendarResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { members } = useMembers(false);
  const membersKey = useMemo(() => members.map((m) => m.id).join('|'), [members]);

  const range = useMemo(() => getRange(currentDate, viewMode), [currentDate, viewMode]);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const lessonsRef = collection(db, 'lessons');
        const qy = query(lessonsRef, where('date', '>=', range.start), where('date', '<=', range.end));
        const snap = await getDocs(qy);

        const memberIndex = new Map(
          members.map((member) => [member.id, member] as const),
        );

        const lessonBuckets = new Map<string, CalendarLesson[]>();

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const date: Date = data.date?.toDate ? data.date.toDate() : new Date(data.date);
          const memberIds: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
          const walkInMemberIds: string[] = Array.isArray(data.walkInMemberIds) ? data.walkInMemberIds : [];
          const absentMemberIds: string[] = Array.isArray(data.absentMemberIds) ? data.absentMemberIds : [];
          const attendedMemberIds: string[] = Array.isArray(data.attendedMemberIds) ? data.attendedMemberIds : [];

          const participants: CalendarParticipant[] = [...new Set([...memberIds, ...walkInMemberIds])].map((id) => {
            const member = memberIndex.get(id);
            const fullName = member
              ? `${member.name ?? ''} ${member.surname ?? ''}`.trim() || member.name || 'Üye'
              : walkInMemberIds.includes(id)
                ? 'Walk-in Üye'
                : 'Üye';

            const status = absentMemberIds.includes(id)
              ? 'absent'
              : attendedMemberIds.includes(id)
                ? 'attended'
                : 'scheduled';

            return {
              id,
              name: fullName,
              status,
              isWalkIn: walkInMemberIds.includes(id),
            };
          });

          const lesson: CalendarLesson = {
            id: docSnap.id,
            title: data.title ?? 'Ders',
            start: date.toISOString(),
            end: data.endDate?.toDate ? data.endDate.toDate().toISOString() : new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
            members: participants.length,
            status: (data.status as CalendarLesson['status']) ?? 'scheduled',
            participants,
            notes: data.notes ?? undefined,
          };

          const bucketKey = dateKeyTZ(date);
          const bucket = lessonBuckets.get(bucketKey) ?? [];
          bucket.push(lesson);
          lessonBuckets.set(bucketKey, bucket);
        });

        const daysPayload: CalendarDay[] = Array.from(lessonBuckets.entries())
          .map(([dateKey, bucket]) => ({
            date: dateKey,
            lessons: bucket.sort((a, b) => a.start.localeCompare(b.start)),
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (mounted) {
          setDays(daysPayload);
        }
      } catch (err) {
        console.error('[useFirestoreCalendar] load error', err);
        if (mounted) {
          setError('Takvim verileri yüklenirken hata oluştu');
          setDays([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [range.start, range.end, membersKey, refetchTrigger]);

  const overview = useMemo<CalendarOverview>(() => {
    if (!days.length) {
      return {
        ...DEFAULT_OVERVIEW,
        rangeLabel:
          viewMode === 'day'
            ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'full', timeZone: TZ }).format(currentDate)
            : `${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: TZ }).format(range.start)} - ${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: TZ }).format(range.end)}`,
      };
    }

    const lessons = days.flatMap((day) => day.lessons);
    const participantCount = lessons.reduce((acc, lesson) => acc + lesson.participants.length, 0);
    const attendedCount = lessons.reduce(
      (acc, lesson) => acc + lesson.participants.filter((p) => p.status === 'attended').length,
      0,
    );

    const attendanceRate = participantCount === 0 ? 0 : attendedCount / participantCount;

    return {
      rangeLabel:
        viewMode === 'day'
          ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'full', timeZone: TZ }).format(currentDate)
          : `${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: TZ }).format(range.start)} - ${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: TZ }).format(range.end)}`,
      totalLessons: lessons.length,
      attendanceRate,
      expiringPackages: 0,
    };
  }, [days, range.end, range.start, currentDate, viewMode]);

  return {
    days,
    overview,
    loading,
    error,
    refetch,
  };
};
