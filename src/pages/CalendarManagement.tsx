import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import Modal from '../components/Modal';

// Local minimal types to avoid external type coupling
type Member = {
  id: string;
  name?: string;
  surname?: string;
  birthDate?: Timestamp | Date | string | null;
};

type Lesson = {
  id: string;
  date: Date;
  memberIds: string[];
  attendedMemberIds: string[]; // legacy, no longer used for logic
  absentMemberIds: string[];   // new source of truth: present by default unless in this list
  walkInMemberIds: string[];
};

const CalendarManagement: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [members, setMembers] = useState<Member[]>([]);
  // Turkish alphabetical sorting for member full names
  const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        collator.compare(`${a.name ?? ''} ${a.surname ?? ''}`.trim(), `${b.name ?? ''} ${b.surname ?? ''}`.trim()),
      ),
    [members, collator],
  );
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [newWalkInId, setNewWalkInId] = useState<string>('');

  // Format helpers
  const TZ = 'Europe/Istanbul';
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(date);
  const formatDayName = (date: Date) =>
    new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, weekday: 'long' }).format(date);
  const formatDayMonth = (date: Date) =>
    new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(date);
  const dateKeyTZ = (date: Date) =>
    new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const sameDayTZ = (a: Date, b: Date) => dateKeyTZ(a) === dateKeyTZ(b);
  const hourTZ = (date: Date) =>
    parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(date), 10);

  // UI helpers

  // Pastel solid color (not gradient) to avoid purge/overrides and keep a soft look
  const memberGradient = useCallback((id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
    const hue = Math.abs(h) % 360;
    // Vibrant pastel: a bit more saturation, a bit darker for contrast
    const bg = `hsl(${hue}, 70%, 80%)`;
    return { backgroundColor: bg } as React.CSSProperties;
  }, []);

  // Birthday helpers
  const monthDayTZ = (date: Date) => {
    const parts = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, month: '2-digit', day: '2-digit' }).formatToParts(date);
    const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '0', 10);
    const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '0', 10);
    return { month, day };
  };

  const toJSDate = (v: any): Date | null => {
    if (!v) return null;
    try {
      if (typeof v?.toDate === 'function') return v.toDate();
      if (v instanceof Date) return v;
      if (typeof v === 'string' || typeof v === 'number') return new Date(v);
    } catch {}
    return null;
  };

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

  // Fetch Members
  useEffect(() => {
    const run = async () => {
      try {
        const snap = await getDocs(collection(db, 'members'));
        const list: Member[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, 'id'>) }));
        setMembers(list);
      } catch (e) {
        console.error(e);
        setError('Üyeler yüklenirken hata oluştu');
      }
    };
    run();
  }, []);

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

  // Keep modal data in sync — but don't close if it's a placeholder (tmp-)
  useEffect(() => {
    if (!selectedLesson) return;
    if (selectedLesson.id.startsWith('tmp-')) return; // keep placeholder until persisted
    const updated = lessons.find((l) => l.id === selectedLesson.id);
    if (updated) {
      setSelectedLesson(updated);
    }
  }, [lessons, selectedLesson?.id]);

  // Absence toggle (present by default unless marked absent)
  const toggleAbsence = async (lessonId: string, memberId: string, isAbsent: boolean) => {
    try {
      const ref = doc(db, 'lessons', lessonId);
      await updateDoc(ref, {
        absentMemberIds: isAbsent ? arrayRemove(memberId) : arrayUnion(memberId),
      });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                absentMemberIds: isAbsent
                  ? l.absentMemberIds.filter((x) => x !== memberId)
                  : [...l.absentMemberIds, memberId],
              }
            : l,
        ),
      );
    } catch (e) {
      console.error(e);
      setError('Devamsızlık güncellenirken hata oluştu');
    }
  };

  // Add Walk-in
  const addWalkIn = async (lessonId: string, memberId: string) => {
    if (!memberId) return;
    try {
      // If this is a placeholder, create the lesson first with this walk-in inside
      if (lessonId.startsWith('tmp-')) {
        if (!selectedLesson) return;
        const created = await addDoc(collection(db, 'lessons'), {
          date: selectedLesson.date,
          memberIds: [],
          attendedMemberIds: [],
          absentMemberIds: [],
          walkInMemberIds: [memberId],
        });
        const newLesson: Lesson = {
          id: created.id,
          date: selectedLesson.date,
          memberIds: [],
          attendedMemberIds: [],
          absentMemberIds: [],
          walkInMemberIds: [memberId],
        };
        // Update local state optimistically
        setLessons((prev) => {
          const next = [...prev, newLesson];
          next.sort((a, b) => a.date.getTime() - b.date.getTime());
          return next;
        });
        setSelectedLesson(newLesson);
        setNewWalkInId('');
        return;
      }

      const ref = doc(db, 'lessons', lessonId);
      await updateDoc(ref, { walkInMemberIds: arrayUnion(memberId) });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                walkInMemberIds: l.walkInMemberIds.includes(memberId)
                  ? l.walkInMemberIds
                  : [...l.walkInMemberIds, memberId],
              }
            : l,
        ),
      );
      setNewWalkInId('');
    } catch (e) {
      console.error(e);
      setError('Randevusuz üye eklenirken hata oluştu');
    }
  };

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
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <h2 className="text-2xl font-bold">{formatDayName(currentDate)}</h2>
          <p className="text-blue-100">{formatDate(currentDate)}</p>
        </div>
        <div className="p-6">
          <div className="divide-y">
            {hours.map((h) => {
              const atHourLessons = list.filter((l) => hourTZ(new Date(l.date)) === h);
              // Flatten to member entries
              const entries = atHourLessons.flatMap((lesson) =>
                [...lesson.memberIds, ...lesson.walkInMemberIds].map((memberId) => ({ lesson, memberId }))
              );
              return (
                <div key={h} className="grid grid-cols-[55px_1fr]">
                  {/* Hour label column */}
                  <div className="p-2 text-sm text-gray-500 border-r flex items-center justify-center">{String(h).padStart(2, '0')}:00</div>
                  {/* Entries column */}
                  <div className="flex w-full p-2 ">
                    <div className="flex w-full min-h-8" style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: `repeat(${Math.max(entries.length, 1)}, minmax(0, 1fr))` }}>
                      {entries.length === 0 ? (
                        <div
                          role="button"
                          tabIndex={0}
                          className="w-full min-h-8 cursor-pointer rounded-md bg-blue-50 transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                          aria-label="Bu saate üye ekle"
                          onClick={() => onEmptyHourClick(h)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEmptyHourClick(h); }}
                        />
                      ) : (
                        entries.map(({ lesson, memberId }, idx) => {
                          const m = members.find((mm) => mm.id === memberId) ?? ({ id: memberId, name: 'Üye' } as Member);
                          const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                          return (
                            <div
                              role="button"
                              tabIndex={0}
                              key={lesson.id + ':' + memberId + ':' + idx}
                              className={`cursor-pointer select-none w-full text-center text-gray-800 text-xs font-medium px-2 py-1 rounded-md truncate shadow-sm hover:opacity-90`}
                              style={memberGradient(memberId)}
                              title={full}
                              onClick={() => setSelectedLesson(lesson)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLesson(lesson); }}
                            >
                              {full}
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
          {birthdaysToday.length > 0 && (
            <div className="mt-6 border-t pt-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Doğum Günleri</h4>
              <div className="space-y-1">
                {[...birthdaysToday]
                  .sort((a, b) => collator.compare(`${a.name ?? ''} ${a.surname ?? ''}`.trim(), `${b.name ?? ''} ${b.surname ?? ''}`.trim()))
                  .map((m) => {
                    const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                    const bd = toJSDate((m as any).birthDate) ?? currentDate;
                    return (
                      <div key={m.id} className="w-full text-sm flex items-center justify-between rounded-md bg-amber-50/60 border border-amber-200 px-3 py-1.5">
                        <span className="flex items-center gap-2 truncate"><span>🎂</span><span className="truncate">{full}</span></span>
                        <span className="text-amber-800 text-xs ml-2 whitespace-nowrap">{formatDayMonth(bd)}</span>
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
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <h2 className="text-2xl font-bold">Haftalık Görünüm</h2>
          <p className="text-purple-100">{formatDate(days[0])} - {formatDate(days[6])}</p>
        </div>
        {/* Header row */}
        <div className="grid grid-cols-8 border-b bg-gray-50">
          <div className="p-3 text-center font-medium text-gray-600 border-r">Saat</div>
          {days.map((d, i) => (
            <div key={i} className="p-3 text-center font-medium text-gray-600 border-r last:border-r-0">
              <div>{formatDayName(d).slice(0, 3)} {d.getDate()}</div>
            </div>
          ))}
        </div>
        {/* Time grid */}
        <div className="divide-y">
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-8">
              {/* Hour label */}
              <div className="p-2 text-sm text-gray-500 border-r flex items-center justify-center">{String(h).padStart(2, '0')}:00</div>
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
                    className={`flex w-full p-2 border-r border-b last:border-r-0 ${today ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className="flex w-full gap-1 min-h-8">
                      {entries.length === 0 ? (
                        <div
                          role="button"
                          tabIndex={0}
                          className="w-full min-h-8 cursor-pointer rounded-md bg-purple-50 transition-colors hover:bg-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                          aria-label="Bu hücreye üye ekle"
                          onClick={() => onEmptyWeekCellClick(d, h)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEmptyWeekCellClick(d, h); }}
                        />
                      ) : (
                        entries.map(({ lesson, memberId }, idx) => {
                          const m = members.find((mm) => mm.id === memberId) ?? ({ id: memberId, name: 'Üye' } as Member);
                          const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                          return (
                            <div
                              role="button"
                              tabIndex={0}
                              key={lesson.id + ':' + memberId + ':' + idx}
                              className={`cursor-pointer select-none text-gray-800 text-[10px] font-medium px-2 py-0.5 rounded max-w-[110px] truncate shadow-sm hover:opacity-90`}
                              style={memberGradient(memberId)}
                              title={full}
                              onClick={() => setSelectedLesson(lesson)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLesson(lesson); }}
                            >
                              {full}
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
        {weekBirthdays.length > 0 && (
          <div className="p-4 border-t">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Doğum Günleri</h4>
            <div className="space-y-1">
              {weekBirthdays.map(({ m, d }) => {
                const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                return (
                  <div key={m.id + ':' + dateKeyTZ(d)} className="w-full text-sm flex items-center justify-between rounded-md bg-amber-50/60 border border-amber-200 px-3 py-1.5">
                    <span className="flex items-center gap-2 truncate"><span>🎂</span><span className="truncate">{full}</span></span>
                    <span className="text-amber-800 text-xs ml-2 whitespace-nowrap">{formatDayMonth(d)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6">
          <h2 className="text-2xl font-bold">Aylık Görünüm</h2>
          <p className="text-green-100">{new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, month: 'long', year: 'numeric' }).format(currentDate)}</p>
        </div>
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
            <div key={d} className="p-3 text-center font-medium text-gray-600 border-r last:border-r-0">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const list = getLessonsForDate(d);
            const inMonth = d.getMonth() === curMonth;
            const today = sameDayTZ(d, new Date());
            return (
              <div
                key={i}
                className={`min-h-24 p-2 border-r border-b last:border-r-0 ${!inMonth ? 'bg-gray-50 text-gray-400' : ''} ${today ? 'bg-blue-50' : ''}`}
              >
                <div className="font-medium text-sm mb-1">{d.getDate()}</div>
                <div className="space-y-1">
                  {list.slice(0, 3).map((l) => (
                    <div
                      key={l.id}
                      className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded cursor-pointer hover:bg-blue-200"
                      onClick={() => setSelectedLesson(l)}
                    >
                      {formatTime(new Date(l.date))}
                    </div>
                  ))}
                  {list.length > 3 && <div className="text-xs text-gray-500">+{list.length - 3} daha</div>}
                </div>
              </div>
            );
          })}
        </div>
        {monthBirthdays.length > 0 && (
          <div className="p-4 border-t">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Doğum Günleri</h4>
            <div className="space-y-1">
              {monthBirthdays.map(({ m, d }) => {
                const full = (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '');
                return (
                  <div key={m.id + ':' + dateKeyTZ(d)} className="w-full text-sm flex items-center justify-between rounded-md bg-amber-50/60 border border-amber-200 px-3 py-1.5">
                    <span className="flex items-center gap-2 truncate"><span>🎂</span><span className="truncate">{full}</span></span>
                    <span className="text-amber-800 text-xs ml-2 whitespace-nowrap">{formatDayMonth(d)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">📅</span>
              </div>
              <h3 className="bg-clip-text text-gray-500">Takvim Yönetimi</h3>
            </div>
            <div className="flex items-center gap-[5px] bg-gray-100 rounded-lg h-[25px] p-0">
              {([
                { key: 'month', label: 'Ay', inactiveBg: '#99f6e4', inactiveText: '#065f46', activeBg: '#0d9488', activeText: '#ffffff' }, // teal
                { key: 'week', label: 'Hafta', inactiveBg: '#e9d5ff', inactiveText: '#3b0764', activeBg: '#7c3aed', activeText: '#ffffff' }, // purple
                { key: 'day', label: 'Gün', inactiveBg: '#bfdbfe', inactiveText: '#0b3b8a', activeBg: '#2563eb', activeText: '#ffffff' }, // blue
              ] as const).map(({ key, label, inactiveBg, inactiveText, activeBg, activeText }) => {
                const active = viewMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setViewMode(key as 'month' | 'week' | 'day')}
                    className="h-full w-[40px] rounded-full font-semibold text-[11px] whitespace-nowrap select-none shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors flex items-center justify-center"
                    style={{ backgroundColor: active ? activeBg : inactiveBg, color: active ? activeText : inactiveText }}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => go('prev')} className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>{viewMode === 'day' ? 'Önceki Gün' : viewMode === 'week' ? 'Önceki Hafta' : 'Önceki Ay'}</span>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="h-[30px] w-[50px] rounded-full flex items-center justify-center font-semibold text-[11px] select-none shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors"
              style={{ backgroundColor: '#0d9488', color: '#ffffff' }}
              aria-label="Bugün'e git"
              title="Bugün"
            >
              Bugün
            </button>
            <button onClick={() => go('next')} className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <span>{viewMode === 'day' ? 'Sonraki Gün' : viewMode === 'week' ? 'Sonraki Hafta' : 'Sonraki Ay'}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 text-lg">Yükleniyor...</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800">{error}</p>
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

      {/* Modal - refactored to shared Modal component with UI tokens */}
      <Modal
        isOpen={!!selectedLesson}
        onClose={() => setSelectedLesson(null)}
        title="Ders Detayı"
      >
        {selectedLesson && (
          <>
            <div className="section">
              <p style={{ color: 'var(--muted-color)' }}>
                {formatDayName(new Date(selectedLesson.date))}, {formatDate(new Date(selectedLesson.date))} - {formatTime(new Date(selectedLesson.date))}
              </p>
            </div>
            <div className="section">
              <h4 className="modal-title" style={{ fontSize: '1rem' }}>Katılımcılar</h4>
              <ul className="list">
                {[...selectedLesson.memberIds, ...selectedLesson.walkInMemberIds].map((id) => {
                  const m = members.find((mm) => mm.id === id) ?? ({ id, name: 'Üye' } as Member);
                  const isAbsent = selectedLesson.absentMemberIds.includes(id);
                  return (
                    <li key={id} className="list-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className={`w-3 h-3 rounded-full`} style={memberGradient(id)} />
                        <span>{(m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '')}</span>
                      </div>
                      <button
                        onClick={() => toggleAbsence(selectedLesson.id, id, isAbsent)}
                        className="inline-flex items-center justify-center rounded-full min-h-[30px] p-[3px] text-xs font-semibold select-none border shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors"
                        style={{ backgroundColor: isAbsent ? '#f87171' : '#fecaca', color: isAbsent ? '#ffffff' : '#7f1d1d', borderColor: isAbsent ? '#ef4444' : '#fca5a5' }}
                        title={isAbsent ? 'Devamsızlığı kaldır' : 'Gelmedi olarak işaretle'}
                      >
                        gelmedi
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="walkin-select">Randevusuz Üye Ekle</label>
                  <select
                    id="walkin-select"
                    className="input"
                    value={newWalkInId}
                    onChange={(e) => setNewWalkInId(e.target.value)}
                  >
                    <option value="">Üye seçin</option>
                    {sortedMembers
                      .filter((m) => ![...selectedLesson.memberIds, ...selectedLesson.walkInMemberIds].includes(m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {(m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '')}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  onClick={() => addWalkIn(selectedLesson.id, newWalkInId)}
                  disabled={!newWalkInId}
                  className="btn btn-primary"
                >
                  + Ekle
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default CalendarManagement;
