import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useMembers, type Member } from '../hooks/useMembers';
import { useLessonOperations } from '../hooks/useLessonOperations';
import { LessonModal } from '../components/calendar/LessonModal';
import { type Lesson, type ExpiringEntry, type ViewMode } from '../types/calendar.types';
import { CALENDAR_THEME, CALENDAR_STYLES } from '../constants/calendarTheme';
import { 
  formatDate, 
  formatTime, 
  formatDayName, 
  formatDayMonth, 
  dateKeyTZ, 
  sameDayTZ, 
  hourTZ,
  monthDayTZ,
  toJSDate,
  TZ
} from '../utils/dateHelpers';
import { memberGradient as getMemberGradient } from '../utils/colorHelpers';

const CalendarManagement: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  
  // Real-time members data with sorting
  const { members, sortedMembers } = useMembers(true);
  
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [newWalkInId, setNewWalkInId] = useState<string>('');
  const [expiring, setExpiring] = useState<ExpiringEntry[]>([]);

  // Use lesson operations hook
  const { toggleAbsence, addWalkIn, removeWalkIn, isCreatingLesson } = useLessonOperations(
    members,
    setLessons,
    setError
  );

  // UI helpers
  const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);
  const memberGradient = useCallback((id: string) => getMemberGradient(id), []);

  const getBirthdaysForDate = useCallback((d: Date) => {
    const md = monthDayTZ(d);
    return members.filter((m) => {
      const bd = toJSDate((m as any).birthDate);
      if (!bd) return false;
      const bmd = monthDayTZ(bd);
      return md.month === bmd.month && md.day === bmd.day;
    });
  }, [members]);

  // Create a placeholder lesson for a given hour on the current day and open modal
  const onEmptyHourClick = useCallback((hour: number) => {
    const d = new Date(currentDate);
    d.setHours(hour, 0, 0, 0);
    const placeholder: Lesson = {
      id: `tmp-${d.getTime()}`,
      date: d,
      memberIds: [],
      attendedMemberIds: [],
      absentMemberIds: [],
      walkInMemberIds: [],
    };
    setSelectedLesson(placeholder);
    setNewWalkInId('');
  }, [currentDate]);

  // Create placeholder for a given week day + hour
  const onEmptyWeekCellClick = useCallback((day: Date, hour: number) => {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    const placeholder: Lesson = {
      id: `tmp-${d.getTime()}`,
      date: d,
      memberIds: [],
      attendedMemberIds: [],
      absentMemberIds: [],
      walkInMemberIds: [],
    };
    setSelectedLesson(placeholder);
    setNewWalkInId('');
  }, []);

  // Members are now loaded via real-time listener (useFirestoreCollection)

  // Compute start-end for queries
  const range = useMemo(() => {
    if (viewMode === 'day') {
      const s = new Date(currentDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(currentDate);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (viewMode === 'week') {
      const base = new Date(currentDate);
      const dow = base.getDay();
      const diff = dow === 0 ? -6 : 1 - dow; // Monday start
      const s = new Date(base);
      s.setDate(base.getDate() + diff);
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    // month
    const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }, [currentDate, viewMode]);

  // Fetch Lessons
  const fetchLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lessonsRef = collection(db, 'lessons');
      const qy = query(lessonsRef, where('date', '>=', range.start), where('date', '<=', range.end));
      const snap = await getDocs(qy);
      // Best-effort cleanup: delete orphans (no memberIds and no walkInMemberIds)
      const orphanDocIds: string[] = [];
      const list: Lesson[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const date: Date = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        const memberIds: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
        const walkInMemberIds: string[] = Array.isArray(data.walkInMemberIds) ? data.walkInMemberIds : [];
        if (memberIds.length === 0 && walkInMemberIds.length === 0) {
          orphanDocIds.push(d.id);
        }
        return {
          id: d.id,
          date,
          memberIds,
          attendedMemberIds: Array.isArray(data.attendedMemberIds) ? data.attendedMemberIds : [],
          absentMemberIds: Array.isArray(data.absentMemberIds) ? data.absentMemberIds : [],
          walkInMemberIds,
        } as Lesson;
      });
      // Delete orphans in background (non-blocking)
      if (orphanDocIds.length) {
        Promise.allSettled(orphanDocIds.map((id) => deleteDoc(doc(db, 'lessons', id)))).catch(() => void 0);
      }
      const filtered = list.filter(l => (l.memberIds?.length || 0) + (l.walkInMemberIds?.length || 0) > 0);
      filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
      setLessons(filtered);
    } catch (e) {
      console.error(e);
      setError('Dersler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Fetch expiring packages (assigned_packages with endDate within range)
  useEffect(() => {
    const run = async () => {
      try {
        const apRef = collection(db, 'assigned_packages');
        const qy = query(apRef, where('endDate', '>=', range.start), where('endDate', '<=', range.end));
        const snap = await getDocs(qy);
        const list: ExpiringEntry[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            const ed = data?.endDate?.toDate ? (data.endDate.toDate() as Date) : (data?.endDate ? new Date(data.endDate) : null);
            const memberId = data?.memberId as string | undefined;
            if (!ed || !memberId) return null;
            return { assignedPackageId: d.id, memberId, endDate: ed } as ExpiringEntry;
          })
          .filter((x): x is ExpiringEntry => Boolean(x));
        // sort by endDate asc for stable ordering
        list.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
        setExpiring(list);
      } catch (e) {
        console.error('Expiring packages fetch error', e);
        setExpiring([]);
      }
    };
    run();
  }, [range.start, range.end]);

  // Keep modal data in sync — but don't close if it's a placeholder (tmp-)
  useEffect(() => {
    if (!selectedLesson || isCreatingLesson) return;
    // This is a placeholder, don't sync from main list
    if (selectedLesson.id.startsWith('tmp-')) return; // keep placeholder until persisted
    const updated = lessons.find((l) => l.id === selectedLesson.id);
    if (updated) {
      setSelectedLesson(updated);
    }
  }, [lessons, selectedLesson?.id, isCreatingLesson]);

  // Helpers for views
  const getLessonsForDate = (date: Date) =>
    lessons.filter((l) => sameDayTZ(new Date(l.date), date));

  const getWeekDays = () => {
    const base = new Date(currentDate);
    const dow = base.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const start = new Date(base);
    start.setDate(base.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const getMonthGrid = () => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const start = new Date(first);
    const dow = first.getDay();
    start.setDate(first.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
    const days: Date[] = [];
    const iter = new Date(start);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(iter));
      iter.setDate(iter.getDate() + 1);
    }
    return { days, first, last };
  };

  // Navigation
  const go = (dir: 'prev' | 'next') => {
    const n = new Date(currentDate);
    if (viewMode === 'day') n.setDate(n.getDate() + (dir === 'next' ? 1 : -1));
    else if (viewMode === 'week') n.setDate(n.getDate() + (dir === 'next' ? 7 : -7));
    else n.setMonth(n.getMonth() + (dir === 'next' ? 1 : -1));
    setCurrentDate(n);
  };

  // Views
  const renderDay = () => {
    const list = getLessonsForDate(currentDate);
    const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 07-21
    const birthdaysToday = getBirthdaysForDate(currentDate);
    return (
      <div 
        className="rounded-3xl overflow-hidden backdrop-blur-xl"
        style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Modern Header with Gradient */}
        <div 
          className="p-8 text-white relative overflow-hidden"
          style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📆</span>
              <h2 className="text-3xl font-bold">{formatDayName(currentDate)}</h2>
            </div>
            <p className="text-white/90 text-lg">{formatDate(currentDate)}</p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.1)' }}></div>
          <div className="absolute -right-4 top-16 w-20 h-20 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.08)' }}></div>
        </div>

        <div className="p-6">
          {/* Time Slots Grid */}
          <div className="space-y-2">
            {hours.map((h) => {
              const atHourLessons = list.filter((l) => hourTZ(new Date(l.date)) === h);
              const entries = atHourLessons.flatMap((lesson) =>
                [...lesson.memberIds, ...lesson.walkInMemberIds].map((memberId) => ({ lesson, memberId }))
              );
              return (
                <div 
                  key={h} 
                  className="grid grid-cols-[80px_1fr] gap-4 p-3 rounded-2xl transition-all duration-200 hover:shadow-md"
                  style={{ background: 'rgba(102, 126, 234, 0.03)' }}
                >
                  {/* Hour label */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: '#667eea' }}>{String(h).padStart(2, '0')}</span>
                    <span className="text-xs text-gray-500">:00</span>
                  </div>
                  
                  {/* Entries */}
                  <div className="flex items-center">
                    <div className="flex flex-wrap gap-2 w-full">
                      {entries.length === 0 ? (
                        <div
                          role="button"
                          tabIndex={0}
                          className="w-full min-h-12 cursor-pointer rounded-xl transition-all duration-300 flex items-center justify-center group"
                          style={{ 
                            background: 'rgba(102, 126, 234, 0.05)',
                            border: '2px dashed rgba(102, 126, 234, 0.2)'
                          }}
                          aria-label="Bu saate üye ekle"
                          onClick={() => onEmptyHourClick(h)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEmptyHourClick(h); }}
                        >
                          <span className="text-gray-400 text-sm font-medium group-hover:text-gray-600 transition-colors">+ Üye Ekle</span>
                        </div>
                      ) : (
                        entries.map(({ lesson, memberId }, idx) => {
                          const m = members.find((mm) => mm.id === memberId) ?? ({ id: memberId, name: 'Üye' } as Member);
                          const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                          const isAbsent = lesson.absentMemberIds.includes(memberId);
                          return (
                            <div
                              role="button"
                              tabIndex={0}
                              key={lesson.id + ':' + memberId + ':' + idx}
                              className="cursor-pointer select-none px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
                              style={{
                                ...memberGradient(memberId),
                                opacity: isAbsent ? 0.5 : 1,
                                border: isAbsent ? '2px solid rgba(0,0,0,0.2)' : 'none'
                              }}
                              title={full + (isAbsent ? ' (Devamsız)' : '')}
                              onClick={() => setSelectedLesson(lesson)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLesson(lesson); }}
                            >
                              {isAbsent && <span>❌</span>}
                              <span>{full}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Birthdays Section */}
          {birthdaysToday.length > 0 && (
            <div className="mt-8 p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
              <h4 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">🎂</span>
                <span>Bugün Doğum Günü Olanlar</span>
              </h4>
              <div className="space-y-2">
                {[...birthdaysToday]
                  .sort((a, b) => collator.compare(`${a.name ?? ''} ${a.surname ?? ''}`.trim(), `${b.name ?? ''} ${b.surname ?? ''}`.trim()))
                  .map((m) => {
                    const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                    const bd = toJSDate((m as any).birthDate) ?? currentDate;
                    return (
                      <div 
                        key={m.id} 
                        className="flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm"
                      >
                        <span className="font-semibold text-amber-900">{full}</span>
                        <span className="text-amber-700 text-sm">{formatDayMonth(bd)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Expiring Packages */}
          {expiring.filter((e) => sameDayTZ(e.endDate, currentDate)).length > 0 && (
            <div className="mt-4 p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)' }}>
              <h4 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">⏳</span>
                <span>Bugün Biten Paketler</span>
              </h4>
              <div className="space-y-2">
                {expiring
                  .filter((e) => sameDayTZ(e.endDate, currentDate))
                  .map((e) => {
                    const m = members.find((mm) => mm.id === e.memberId);
                    const full = ((m?.name || 'Üye') + (m?.surname ? ` ${m.surname}` : '')).trim();
                    return (
                      <div 
                        key={e.assignedPackageId} 
                        className="flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm"
                      >
                        <span className="font-semibold text-red-900">{full}</span>
                        <span className="text-red-700 text-sm">{formatDayMonth(e.endDate)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeek = () => {
    const days = getWeekDays();
    const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 07-21
    const weekBirthdays = days.flatMap((d) => getBirthdaysForDate(d).map((m) => ({ m, d })));
    weekBirthdays.sort((a, b) => {
      const t = a.d.getTime() - b.d.getTime();
      if (t !== 0) return t;
      return collator.compare(`${a.m.name ?? ''} ${a.m.surname ?? ''}`.trim(), `${b.m.name ?? ''} ${b.m.surname ?? ''}`.trim());
    });
    return (
      <div 
        className="rounded-3xl overflow-hidden backdrop-blur-xl"
        style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Modern Header */}
        <div 
          className="p-8 text-white relative overflow-hidden"
          style={{ 
            background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)'
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📅</span>
              <h2 className="text-3xl font-bold">Haftalık Görünüm</h2>
            </div>
            <p className="text-white/90 text-lg">{formatDate(days[0])} - {formatDate(days[6])}</p>
          </div>
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.1)' }}></div>
        </div>

        {/* Week Grid */}
        <div className="overflow-x-auto">
          {/* Header row - Days */}
          <div className="grid grid-cols-8 gap-px p-2" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
            <div className="p-4 text-center font-bold text-gray-600 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.8)' }}>
              <span className="text-sm">⏰</span>
            </div>
            {days.map((d, i) => {
              const today = sameDayTZ(d, new Date());
              return (
                <div 
                  key={i} 
                  className="p-4 text-center font-bold rounded-xl"
                  style={{ 
                    background: today ? 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)' : 'rgba(255, 255, 255, 0.8)',
                    color: today ? 'white' : '#4b5563'
                  }}
                >
                  <div className="text-xs opacity-80">{formatDayName(d).slice(0, 3)}</div>
                  <div className="text-lg font-bold">{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="p-2 space-y-1">
            {hours.map((h) => (
              <div key={h} className="grid grid-cols-8 gap-px">
                {/* Hour label */}
                <div className="p-2 flex flex-col items-center justify-center rounded-xl" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
                  <span className="text-lg font-bold" style={{ color: '#a78bfa' }}>{String(h).padStart(2, '0')}</span>
                  <span className="text-xs text-gray-500">:00</span>
                </div>
                
                {/* Day columns */}
                {days.map((d, di) => {
                  const list = getLessonsForDate(d).filter((l) => hourTZ(new Date(l.date)) === h);
                  const entries = list.flatMap((lesson) =>
                    [...lesson.memberIds, ...lesson.walkInMemberIds].map((memberId) => ({ lesson, memberId }))
                  );
                  const today = sameDayTZ(d, new Date());
                  return (
                    <div
                      key={di}
                      className="p-2 rounded-xl min-h-16 flex items-center justify-center"
                      style={{ 
                        background: today ? 'rgba(167, 139, 250, 0.08)' : 'rgba(167, 139, 250, 0.03)'
                      }}
                    >
                      <div className="flex flex-wrap gap-1 w-full justify-center">
                        {entries.length === 0 ? (
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full min-h-12 cursor-pointer rounded-lg transition-all duration-300 flex items-center justify-center group"
                            style={{ 
                              border: '2px dashed rgba(167, 139, 250, 0.2)'
                            }}
                            aria-label="Bu hücreye üye ekle"
                            onClick={() => onEmptyWeekCellClick(d, h)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEmptyWeekCellClick(d, h); }}
                          >
                            <span className="text-gray-400 text-xs group-hover:text-gray-600 transition-colors">+</span>
                          </div>
                        ) : (
                          entries.map(({ lesson, memberId }, idx) => {
                            const m = members.find((mm) => mm.id === memberId) ?? ({ id: memberId, name: 'Üye' } as Member);
                            const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                            const isAbsent = lesson.absentMemberIds.includes(memberId);
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                key={lesson.id + ':' + memberId + ':' + idx}
                                className="cursor-pointer select-none text-[10px] font-semibold px-2 py-1 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 truncate max-w-full"
                                style={{
                                  ...memberGradient(memberId),
                                  opacity: isAbsent ? 0.4 : 1,
                                }}
                                title={full + (isAbsent ? ' (Devamsız)' : '')}
                                onClick={() => setSelectedLesson(lesson)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLesson(lesson); }}
                              >
                                {isAbsent ? '❌' : full}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-6 space-y-4">
          {weekBirthdays.length > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
              <h4 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                <span>🎂</span>
                <span>Doğum Günleri</span>
              </h4>
              <div className="space-y-2">
                {weekBirthdays.map(({ m, d }) => {
                  const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                  return (
                    <div key={m.id + ':' + dateKeyTZ(d)} className="flex items-center justify-between p-2 rounded-lg bg-white/60 text-sm">
                      <span className="font-semibold text-amber-900">{full}</span>
                      <span className="text-amber-700 text-xs">{formatDayMonth(d)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {expiring.length > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)' }}>
              <h4 className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2">
                <span>⏳</span>
                <span>Paket Bitişleri</span>
              </h4>
              <div className="space-y-2">
                {expiring.map((e) => {
                  const m = members.find((mm) => mm.id === e.memberId);
                  const full = ((m?.name || 'Üye') + (m?.surname ? ` ${m.surname}` : '')).trim();
                  return (
                    <div key={e.assignedPackageId} className="flex items-center justify-between p-2 rounded-lg bg-white/60 text-sm">
                      <span className="font-semibold text-red-900">{full}</span>
                      <span className="text-red-700 text-xs">{formatDayMonth(e.endDate)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    const { days } = getMonthGrid();
    const curMonth = currentDate.getMonth();
    // Collect birthdays for the whole month view
    const monthBirthdays = members.flatMap((m) => {
      const bd = toJSDate((m as any).birthDate);
      if (!bd) return [] as { m: Member; d: Date }[];
      const { month, day } = monthDayTZ(bd);
      if (month !== curMonth + 1) return [] as { m: Member; d: Date }[];
      const occ = new Date(currentDate);
      occ.setMonth(curMonth, day);
      occ.setHours(12, 0, 0, 0);
      return [{ m, d: occ }];
    });
    monthBirthdays.sort((a, b) => {
      const t = a.d.getTime() - b.d.getTime();
      if (t !== 0) return t;
      return collator.compare(`${a.m.name ?? ''} ${a.m.surname ?? ''}`.trim(), `${b.m.name ?? ''} ${b.m.surname ?? ''}`.trim());
    });
    return (
      <div 
        className="rounded-3xl overflow-hidden backdrop-blur-xl"
        style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Modern Header */}
        <div 
          className="p-8 text-white relative overflow-hidden"
          style={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)'
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🗓️</span>
              <h2 className="text-3xl font-bold">Aylık Görünüm</h2>
            </div>
            <p className="text-white/90 text-lg">{new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, month: 'long', year: 'numeric' }).format(currentDate)}</p>
          </div>
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.1)' }}></div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d, idx) => (
              <div 
                key={d} 
                className="p-3 text-center font-bold text-sm rounded-xl"
                style={{ 
                  background: idx >= 5 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: idx >= 5 ? '#dc2626' : '#059669'
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((d, i) => {
              const list = getLessonsForDate(d);
              const inMonth = d.getMonth() === curMonth;
              const today = sameDayTZ(d, new Date());
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={i}
                  className="min-h-28 p-3 rounded-2xl transition-all duration-200 hover:shadow-lg cursor-pointer"
                  style={{ 
                    background: today 
                      ? 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' 
                      : inMonth 
                        ? isWeekend 
                          ? 'rgba(239, 68, 68, 0.05)' 
                          : 'rgba(16, 185, 129, 0.05)'
                        : 'rgba(156, 163, 175, 0.05)',
                    opacity: inMonth ? 1 : 0.5,
                    border: today ? '2px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <div 
                    className="font-bold text-sm mb-2 flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ 
                      color: today ? 'white' : inMonth ? '#374151' : '#9ca3af',
                      background: today ? 'rgba(255, 255, 255, 0.2)' : 'transparent'
                    }}
                  >
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {list.slice(0, 2).map((l) => {
                      const memberCount = (l.memberIds?.length || 0) + (l.walkInMemberIds?.length || 0);
                      return (
                        <div
                          key={l.id}
                          className="text-xs px-2 py-1.5 rounded-lg font-semibold cursor-pointer transition-all duration-200 hover:scale-105 shadow-sm"
                          style={{ 
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.8) 0%, rgba(20, 184, 166, 0.8) 100%)',
                            color: 'white'
                          }}
                          onClick={() => setSelectedLesson(l)}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>{formatTime(new Date(l.date))}</span>
                            <span className="text-[10px] opacity-90">👥{memberCount}</span>
                          </div>
                        </div>
                      );
                    })}
                    {list.length > 2 && (
                      <div className="text-[10px] text-center font-semibold" style={{ color: '#059669' }}>
                        +{list.length - 2} daha
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-6 space-y-4">
          {monthBirthdays.length > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
              <h4 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                <span>🎂</span>
                <span>Bu Ay Doğum Günü Olanlar</span>
              </h4>
              <div className="space-y-2">
                {monthBirthdays.map(({ m, d }) => {
                  const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                  return (
                    <div key={m.id + ':' + dateKeyTZ(d)} className="flex items-center justify-between p-2 rounded-lg bg-white/60 text-sm">
                      <span className="font-semibold text-amber-900">{full}</span>
                      <span className="text-amber-700 text-xs">{formatDayMonth(d)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {expiring.length > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)' }}>
              <h4 className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2">
                <span>⏳</span>
                <span>Bu Ay Biten Paketler</span>
              </h4>
              <div className="space-y-2">
                {expiring.map((e) => {
                  const m = members.find((mm) => mm.id === e.memberId);
                  const full = ((m?.name || 'Üye') + (m?.surname ? ` ${m.surname}` : '')).trim();
                  return (
                    <div key={e.assignedPackageId} className="flex items-center justify-between p-2 rounded-lg bg-white/60 text-sm">
                      <span className="font-semibold text-red-900">{full}</span>
                      <span className="text-red-700 text-xs">{formatDayMonth(e.endDate)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: CALENDAR_THEME.gradients.primary }}>
      {/* Modern Header with Glassmorphism */}
      <div 
        className="sticky top-0 z-20 backdrop-blur-xl border-b"
        style={CALENDAR_STYLES.header.container}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo & Title */}
            <div className="flex items-center space-x-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform"
                style={CALENDAR_STYLES.header.logo}
              >
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Takvim</h1>
                <p className="text-sm text-white/70">Ders Programı Yönetimi</p>
              </div>
            </div>

            {/* View Mode Switcher - Modern Pills */}
            <div className="flex items-center gap-2 p-2 rounded-2xl" style={CALENDAR_STYLES.viewModePill.container}>
              {([
                { key: 'day', label: 'Gün', icon: '📆' },
                { key: 'week', label: 'Hafta', icon: '📅' },
                { key: 'month', label: 'Ay', icon: '🗓️' },
              ] as const).map(({ key, label, icon }) => {
                const active = viewMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setViewMode(key as 'month' | 'week' | 'day')}
                    className="py-3 rounded-xl font-bold text-base whitespace-nowrap select-none transition-all duration-300 flex items-center justify-center gap-2"
                    style={active ? CALENDAR_STYLES.viewModePill.active : CALENDAR_STYLES.viewModePill.inactive}
                    aria-pressed={active}
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Bar - Floating Style */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="rounded-2xl p-4 backdrop-blur-xl" style={CALENDAR_STYLES.navigation.container}>
          <div className="flex items-center justify-between gap-3">
            {/* Previous Button */}
            <button 
              onClick={() => go('prev')} 
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105"
              style={CALENDAR_STYLES.navigation.button}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">{viewMode === 'day' ? 'Önceki Gün' : viewMode === 'week' ? 'Önceki Hafta' : 'Önceki Ay'}</span>
            </button>

            {/* Today Button - Prominent */}
            <button
              onClick={() => setCurrentDate(new Date())}
              className="py-3 rounded-xl font-bold text-base select-none transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
              style={CALENDAR_STYLES.navigation.todayButton}
              aria-label="Bugün'e git"
            >
              <span className="text-xl">🎯</span>
              <span>Bugün</span>
            </button>

            {/* Next Button */}
            <button 
              onClick={() => go('next')} 
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105"
              style={CALENDAR_STYLES.navigation.button}
            >
              <span className="hidden sm:inline">{viewMode === 'day' ? 'Sonraki Gün' : viewMode === 'week' ? 'Sonraki Hafta' : 'Sonraki Ay'}</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {loading && (
          <div 
            className="flex flex-col items-center justify-center py-20 rounded-3xl backdrop-blur-xl"
            style={{ background: 'rgba(255, 255, 255, 0.15)' }}
          >
            <div 
              className="animate-spin rounded-full h-16 w-16 border-4 border-white/30"
              style={{ borderTopColor: 'white' }}
            ></div>
            <span className="mt-4 text-white text-lg font-medium">Yükleniyor...</span>
          </div>
        )}

        {error && (
          <div 
            className="mb-6 rounded-2xl p-6 backdrop-blur-xl"
            style={{ 
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-white font-medium">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {viewMode === 'day' && renderDay()}
            {viewMode === 'week' && renderWeek()}
            {viewMode === 'month' && renderMonth()}
          </>
        )}
      </div>

      {/* Lesson Modal */}
      <LessonModal
        selectedLesson={selectedLesson}
        members={members}
        sortedMembers={sortedMembers}
        newWalkInId={newWalkInId}
        setNewWalkInId={setNewWalkInId}
        setSelectedLesson={setSelectedLesson}
        toggleAbsence={toggleAbsence}
        addWalkIn={addWalkIn}
        removeWalkIn={removeWalkIn}
      />
    </div>
  );
};

export default CalendarManagement;
