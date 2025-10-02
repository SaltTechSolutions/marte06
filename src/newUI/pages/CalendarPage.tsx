import { useCallback, useMemo, useState } from 'react';
import { AppShell, AppHeader, Sidebar } from '../layout';
import { Button } from '../primitives/Button';
import {
  CalendarSummary,
  LessonList,
  CalendarEmptyState,
  LessonDetailDrawer,
} from '../modules/Calendar';
import { useFirestoreCalendar } from '../modules/Calendar/hooks/useFirestoreCalendar';
import CalendarWeekGrid from '../modules/Calendar/components/CalendarWeekGrid';
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
  const { days, overview, loading } = useFirestoreCalendar({ currentDate, viewMode });
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, Record<string, string>>>({});

  const handleCreateLesson = useCallback(() => {
    // TODO: Wire to new lesson creation flow.
    // For sample page we simply log.
    console.info('Yeni ders oluşturma akışı tetiklenecek.');
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
      if (!lesson) continue;
      const overrides = attendanceOverrides[lesson.id];
      if (!overrides) return lesson;
      return {
        ...lesson,
        participants: lesson.participants.map((p) =>
          overrides[p.id]
            ? {
                ...p,
                status: overrides[p.id] as typeof p.status,
              }
            : p,
        ),
      };
    }
    return null;
  }, [selectedLessonId, days, attendanceOverrides]);

  const handleMarkAttendance = useCallback(
    (lessonId: string, participantId: string, status: string) => {
      setAttendanceOverrides((prev) => ({
        ...prev,
        [lessonId]: {
          ...(prev[lessonId] ?? {}),
          [participantId]: status,
        },
      }));
    },
    [],
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
          <Button variant="primary">Ders Oluştur</Button>
        </div>
      }
    />
  );

  const sidebar = <Sidebar sections={sidebarSections} />;

  return (
    <AppShell header={header} sidebar={sidebar}>
      <div className="grid gap-6 min-h-screen pb-6">
        <CalendarSummary overview={overview} />
        {loading ? (
          <div className="flex justify-center items-center py-16 text-neutral-500">Takvim yükleniyor…</div>
        ) : days.length && viewMode === 'week' ? (
          <CalendarWeekGrid
            currentDate={currentDate}
            days={days}
            onOpenLesson={(lessonId) => handleOpenLesson(lessonId)}
            onEmptySlot={(date, hour) => {
              console.info('Yeni ders için slot seçildi', date, hour);
              handleCreateLesson();
              setCurrentDate(date);
            }}
          />
        ) : days.length && viewMode === 'day' ? (
          <LessonList
            days={days}
            onOpenLesson={(_, lessonId) => handleOpenLesson(lessonId)}
          />
        ) : (
          <CalendarEmptyState onCreateLesson={handleCreateLesson} />
        )}
      </div>
      <LessonDetailDrawer
        lesson={selectedLesson}
        onClose={handleCloseLesson}
        onMarkAttendance={handleMarkAttendance}
      />
    </AppShell>
  );
};

export default CalendarPage;
