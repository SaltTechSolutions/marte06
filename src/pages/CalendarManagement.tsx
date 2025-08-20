import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Local minimal types to avoid external type coupling
type Member = {
  id: string;
  name?: string;
  surname?: string;
};

type Lesson = {
  id: string;
  date: Date;
  memberIds: string[];
  attendedMemberIds: string[];
  walkInMemberIds: string[];
};

const CalendarManagement: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [members, setMembers] = useState<Member[]>([]);
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
  const dateKeyTZ = (date: Date) =>
    new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const sameDayTZ = (a: Date, b: Date) => dateKeyTZ(a) === dateKeyTZ(b);
  const hourTZ = (date: Date) =>
    parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(date), 10);

  // UI helpers
  const memberColor = useCallback((id: string) => {
    const palette = [
      'from-blue-500 to-blue-600',
      'from-emerald-500 to-emerald-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-red-500 to-red-600',
      'from-yellow-500 to-yellow-600',
      'from-teal-500 to-teal-600',
      'from-orange-500 to-orange-600',
      'from-cyan-500 to-cyan-600',
      'from-rose-500 to-rose-600',
      'from-lime-500 to-lime-600',
    ];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
    return palette[Math.abs(h) % palette.length];
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
      const list: Lesson[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const date: Date = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        return {
          id: d.id,
          date,
          memberIds: data.memberIds || [],
          attendedMemberIds: data.attendedMemberIds || [],
          walkInMemberIds: data.walkInMemberIds || [],
        } as Lesson;
      });
      list.sort((a, b) => a.date.getTime() - b.date.getTime());
      setLessons(list);
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

  // Keep modal data in sync
  useEffect(() => {
    if (!selectedLesson) return;
    const updated = lessons.find((l) => l.id === selectedLesson.id) || null;
    setSelectedLesson(updated);
    // reset walk-in selector when lesson changes
    setNewWalkInId('');
  }, [lessons, selectedLesson?.id]);

  // Attendance toggle
  const toggleAttendance = async (lessonId: string, memberId: string, isAttended: boolean) => {
    try {
      const ref = doc(db, 'lessons', lessonId);
      await updateDoc(ref, {
        attendedMemberIds: isAttended ? arrayRemove(memberId) : arrayUnion(memberId),
      });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                attendedMemberIds: isAttended
                  ? l.attendedMemberIds.filter((x) => x !== memberId)
                  : [...l.attendedMemberIds, memberId],
              }
            : l,
        ),
      );
    } catch (e) {
      console.error(e);
      setError('Yoklama güncellenirken hata oluştu');
    }
  };

  // Add Walk-in
  const addWalkIn = async (lessonId: string, memberId: string) => {
    if (!memberId) return;
    try {
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
      setError('Walk-in eklenirken hata oluştu');
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
    const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 06-20
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <h2 className="text-2xl font-bold">{formatDayName(currentDate)}</h2>
          <p className="text-blue-100">{formatDate(currentDate)}</p>
        </div>
        <div className="p-6">
          {list.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-lg">Bugün için ders bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hours.map((h) => {
                const atHour = list.filter((l) => hourTZ(new Date(l.date)) === h);
                if (!atHour.length) return null;
                return (
                  <div key={h} className="border-l-4 border-blue-500 pl-4">
                    <div className="text-sm font-medium text-gray-500 mb-2">{String(h).padStart(2, '0')}:00</div>
                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${atHour.length}, 1fr)` }}>
                      {atHour.map((lesson) => {
                        const ids = [...lesson.memberIds, ...lesson.walkInMemberIds];
                        const ms = ids.map((id) => members.find((m) => m.id === id) ?? ({ id, name: 'Üye' } as Member));
                        return (
                          <div
                            key={lesson.id}
                            className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => setSelectedLesson(lesson)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-600">{formatTime(new Date(lesson.date))}</span>
                              <span className="text-xs text-gray-400">{ids.length} üye</span>
                            </div>
                            <div className="text-sm text-gray-800">
                              {ms.map((m) => (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '')).join(', ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeek = () => {
    const days = getWeekDays();
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <h2 className="text-2xl font-bold">Haftalık Görünüm</h2>
          <p className="text-purple-100">{formatDate(days[0])} - {formatDate(days[6])}</p>
        </div>
        <div className="grid grid-cols-7 border-b">
          {days.map((d, i) => (
            <div key={i} className="p-4 text-center border-r last:border-r-0">
              <div className="text-sm font-medium text-gray-600">{formatDayName(d).slice(0, 3)}</div>
              <div className="text-lg font-bold text-gray-900 mt-1">{d.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-96">
          {days.map((d, i) => {
            const list = getLessonsForDate(d);
            const today = sameDayTZ(d, new Date());
            return (
              <div key={i} className={`p-2 border-r last:border-r-0 ${today ? 'bg-blue-50' : ''}`}>
                <div className="space-y-2">
                  {list.map((lesson) => {
                    const ids = [...lesson.memberIds, ...lesson.walkInMemberIds];
                    const ms = ids.map((id) => members.find((m) => m.id === id) ?? ({ id, name: 'Üye' } as Member));
                    return (
                      <div
                        key={lesson.id}
                        className="bg-white border border-gray-200 rounded-md p-2 hover:shadow-sm transition-shadow cursor-pointer text-xs"
                        onClick={() => setSelectedLesson(lesson)}
                      >
                        <div className="font-medium text-gray-700 mb-1">{formatTime(new Date(lesson.date))}</div>
                        <div className="text-xs text-gray-700 truncate">
                          {ms.map((m) => (m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '')).join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    const { days } = getMonthGrid();
    const curMonth = currentDate.getMonth();
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
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Takvim Yönetimi</h1>
            </div>
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              {(['month', 'week', 'day'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {m === 'month' ? 'Ay' : m === 'week' ? 'Hafta' : 'Gün'}
                </button>
              ))}
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
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
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

      {/* Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setSelectedLesson(null)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Ders Detayı</h3>
                  <button onClick={() => setSelectedLesson(null)} className="text-white hover:text-gray-200">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-blue-100 mt-1">
                  {formatDayName(new Date(selectedLesson.date))}, {formatDate(new Date(selectedLesson.date))} - {formatTime(new Date(selectedLesson.date))}
                </p>
              </div>
              <div className="px-6 py-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Katılımcılar</h4>
                <div className="space-y-3">
                  {[...selectedLesson.memberIds, ...selectedLesson.walkInMemberIds].map((id) => {
                    const m = members.find((mm) => mm.id === id) ?? ({ id, name: 'Üye' } as Member);
                    const isAttended = selectedLesson.attendedMemberIds.includes(id);
                    return (
                      <div key={id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${memberColor(id)}`} />
                          <span className="font-medium text-gray-900">{(m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '')}</span>
                        </div>
                        <button
                          onClick={() => toggleAttendance(selectedLesson.id, id, isAttended)}
                          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${isAttended ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {isAttended && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>{isAttended ? 'Yoklandı' : 'Yoklamayı İşaretle'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add walk-in */}
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Walk-in Üye Ekle</label>
                      <select
                        className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        value={newWalkInId}
                        onChange={(e) => setNewWalkInId(e.target.value)}
                      >
                        <option value="">Üye seçin</option>
                        {members
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
                      className={`px-4 py-2 rounded-md font-medium text-white ${newWalkInId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                      + Ekle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarManagement;
