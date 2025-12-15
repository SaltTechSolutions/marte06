import { useCallback, useMemo, useState } from 'react';
import { AppShell, AppHeader, Sidebar } from '../layout';
import { Button } from '../primitives/Button';
import {
  CalendarSummary,
  CalendarEmptyState,
  LessonDetailDrawer,
  LessonModal,
} from '../modules/Calendar';
import { useFirestoreCalendar } from '../modules/Calendar/hooks/useFirestoreCalendar';
import CalendarWeekGrid from '../modules/Calendar/components/CalendarWeekGrid';
import CalendarDayTimeline from '../modules/Calendar/components/CalendarDayTimeline';
import { useMembers } from '../../hooks/useMembers';
import { useLessonOperations } from '../../hooks/useLessonOperations';
import '../foundation/globals.css';

const sidebarSections = [
  {
    key: 'main',
    title: 'Menü',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
      { key: 'calendar', label: 'Takvim', href: '/calendar', active: true },
      { key: 'members', label: 'Üyeler', href: '/members' },
      { key: 'packages', label: 'Paketler', href: '/packages' },
    ],
  },
  {
    key: 'reports',
    title: 'Raporlama',
    items: [
      { key: 'attendance', label: 'Katılım', href: '/reports/attendance' },
      { key: 'payments', label: 'Ödemeler', href: '/reports/payments' },
    ],
  },
];

export const CalendarPage = () => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const { days, overview, loading, refetch } = useFirestoreCalendar({ currentDate, viewMode });
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [newLessonSlot, setNewLessonSlot] = useState<{ date: Date; hour: number } | null>(null);
  const { members } = useMembers(false);

  // Placeholder state for useLessonOperations - will be replaced when we sync with Firestore refetch
  const [, setLessons] = useState<any[]>([]);
  const [, setError] = useState<string | null>(null);
  const { toggleAbsence } = useLessonOperations(members, setLessons, setError);

  const handleCreateLesson = useCallback((date?: Date, hour?: number) => {
    setIsCreatingLesson(true);
    if (date && hour !== undefined) {
      setNewLessonSlot({ date, hour });
    }
  }, []);

  const handleOpenLesson = useCallback((lessonId: string) => {
    setSelectedLessonId(lessonId);
  }, []);

  const handleCloseLesson = useCallback(() => {
    setSelectedLessonId(null);
  }, []);

  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    for (const day of days) {
      const lesson = day.lessons.find((l) => l.id === selectedLessonId);
      if (lesson) return lesson;
    }
    return null;
  }, [selectedLessonId, days]);

  const handleMarkAttendance = useCallback(
    async (lessonId: string, participantId: string, status: string) => {
      if (status === 'absent') {
        await toggleAbsence(lessonId, participantId, false);
      } else if (status === 'attended') {
        await toggleAbsence(lessonId, participantId, true);
      }
      // Refetch calendar data after attendance update
      setTimeout(() => refetch(), 500);
    },
    [toggleAbsence, refetch],
  );

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToAdjacentRange = useCallback(
    (direction: 'prev' | 'next') => {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        const delta = viewMode === 'day' ? 1 : 7;
        next.setDate(prev.getDate() + (direction === 'next' ? delta : -delta));
        return next;
      });
    },
    [viewMode],
  );

  const header = (
    <AppHeader
      title="Takvim"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="neutral" tone="ghost" size="sm" onClick={goToToday}>
            Bugün
          </Button>
          <Button
            variant="neutral"
            tone="ghost"
            size="sm"
            onClick={() => goToAdjacentRange('prev')}
          >
            ← Önceki
          </Button>
          <Button
            variant="neutral"
            tone="ghost"
            size="sm"
            onClick={() => goToAdjacentRange('next')}
          >
            Sonraki →
          </Button>
          <Button
            variant="neutral"
            tone={viewMode === 'day' ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
          >
            Günlük
          </Button>
          <Button
            variant="neutral"
            tone={viewMode === 'week' ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            Haftalık
          </Button>
          <Button variant="primary" onClick={() => handleCreateLesson()}>Ders Oluştur</Button>
        </div>
      }
    />
  );

  const sidebar = <Sidebar sections={sidebarSections} />;

  return (
    <AppShell header={header} sidebar={sidebar}>
      <div className="grid gap-4 pb-6" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
        {loading ? (
          <div className="flex justify-center items-center py-16 text-neutral-500">Takvim yükleniyor…</div>
        ) : days.length && viewMode === 'week' ? (
          <>
            <CalendarWeekGrid
              currentDate={currentDate}
              days={days}
              onOpenLesson={(lessonId) => handleOpenLesson(lessonId)}
              onEmptySlot={(date, hour) => {
                console.info('Yeni ders için slot seçildi', date, hour);
                handleCreateLesson(date, hour);
              }}
            />
            <CalendarSummary overview={overview} />
          </>
        ) : days.length && viewMode === 'day' ? (
          <>
            <CalendarDayTimeline
              currentDate={currentDate}
              days={days}
              onOpenLesson={(lessonId) => handleOpenLesson(lessonId)}
              onEmptySlot={(date, hour) => {
                console.info('Yeni ders için slot seçildi', date, hour);
                handleCreateLesson(date, hour);
              }}
            />
            <CalendarSummary overview={overview} />
          </>
        ) : (
          <>
            <CalendarEmptyState onCreateLesson={handleCreateLesson} />
            <CalendarSummary overview={overview} />
          </>
        )}
      </div>
      <LessonDetailDrawer
        lesson={selectedLesson}
        onClose={handleCloseLesson}
        onMarkAttendance={handleMarkAttendance}
        onRefetch={refetch}
      />
      {isCreatingLesson && (
        <LessonModal
          lesson={null}
          slotDate={newLessonSlot?.date}
          slotHour={newLessonSlot?.hour}
          onRefetch={refetch}
          onClose={() => {
            setIsCreatingLesson(false);
            setNewLessonSlot(null);
          }}
        />
      )}
    </AppShell>
  );
};

export default CalendarPage;
