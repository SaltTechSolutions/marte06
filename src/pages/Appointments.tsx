import React, { useState, useEffect, useCallback } from 'react';
import type { Member } from '../components/MemberList';
import { collection, query, where, getDocs, getDoc, doc, setDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const Appointments: React.FC = () => {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [freeEdit, setFreeEdit] = useState<boolean>(false);
  const [memberLessons, setMemberLessons] = useState<{ id: string; date: Date }[]>([]);
  const [loadingMemberLessons, setLoadingMemberLessons] = useState<boolean>(false);

  // Recurring appointment state
  const [recurringMemberId, setRecurringMemberId] = useState<string>('');
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([]); // 0=Sun..6=Sat
  const [recurringTime, setRecurringTime] = useState<string>('08:00');
  const [recurringStart, setRecurringStart] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [recurringEnd, setRecurringEnd] = useState<string>('');
  const [suggestedEnd, setSuggestedEnd] = useState<string>('');
  const [creatingRecurring, setCreatingRecurring] = useState<boolean>(false);

  // Fetch members on mount
  useEffect(() => {
    const fetchAllMembers = async () => {
      try {
        const membersCollection = collection(db, 'members');
        const membersSnapshot = await getDocs(membersCollection);
        const membersList: Member[] = membersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<Member, 'id'>),
        }));
        setMembers(membersList);
      } catch (error: unknown) {
        console.error('Error fetching members:', error);
        const message = error instanceof Error ? error.message : String(error);
        setSaveError('Üyeler yüklenirken bir hata oluştu: ' + message);
      }
    };
    fetchAllMembers();
  }, []);

  // Helper: parse YYYY-MM-DD to Date (local)
  const parseYMD = (str: string): Date | null => {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    if ([y, m, d].some(n => Number.isNaN(n))) return null;
    return new Date(y, m - 1, d);
  };

  // Format lesson time in Europe/Istanbul for consistent display
  const TZ = 'Europe/Istanbul';
  const formatLessonUTC = (dt: Date): string => {
    const parts = new Intl.DateTimeFormat('tr-TR', {
      timeZone: TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
  };

  // Suggest end date from assigned_packages for selected member
  const fetchActivePackageEnd = useCallback(async (memberId: string) => {
    if (!memberId) {
      setSuggestedEnd('');
      return;
    }
    try {
      const qAP = query(collection(db, 'assigned_packages'), where('memberId', '==', memberId));
      const snap = await getDocs(qAP);
      let latestEndMs = 0;
      snap.forEach(docSnap => {
        const raw = docSnap.data() as Record<string, unknown>;
        const endTs = raw?.endDate as { toDate?: () => Date } | undefined;
        if (endTs && typeof endTs.toDate === 'function') {
          const ms = endTs.toDate().getTime();
          if (ms > latestEndMs) latestEndMs = ms;
        }
      });
      if (latestEndMs > 0) {
        const latestEnd = new Date(latestEndMs);
        const y = latestEnd.getFullYear();
        const m = String(latestEnd.getMonth() + 1).padStart(2, '0');
        const d = String(latestEnd.getDate()).padStart(2, '0');
        const formatted = `${y}-${m}-${d}`;
        setSuggestedEnd(formatted);
        setRecurringEnd(prev => prev || formatted);
      } else {
        setSuggestedEnd('');
      }
    } catch (e) {
      console.error('Paket bitiş tarihi alınamadı:', e);
      setSuggestedEnd('');
    }
  }, []);

  useEffect(() => {
    fetchActivePackageEnd(recurringMemberId);
  }, [recurringMemberId, fetchActivePackageEnd]);

  // Fetch lessons for selected member and reset day/time selections
  const fetchLessonsForMember = useCallback(async (memberId: string) => {
    if (!memberId) {
      setMemberLessons([]);
      return;
    }
    setLoadingMemberLessons(true);
    try {
      const qL = query(collection(db, 'lessons'), where('memberIds', 'array-contains', memberId));
      const snap = await getDocs(qL);
      const list: { id: string; date: Date }[] = snap.docs
        .map(d => {
          const raw = d.data() as Record<string, any>;
          const ts = raw?.date;
          const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
          return dt ? { id: d.id, date: dt } : null;
        })
        .filter((x): x is { id: string; date: Date } => Boolean(x))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      setMemberLessons(list);
    } catch (e) {
      console.error('Üyenin randevuları alınamadı:', e);
      setMemberLessons([]);
    } finally {
      setLoadingMemberLessons(false);
    }
  }, []);

  useEffect(() => {
    // Reset day and time selections when member changes
    setRecurringWeekdays([]);
    setRecurringTime('08:00');
    // Fetch member's appointments
    fetchLessonsForMember(recurringMemberId);
  }, [recurringMemberId, fetchLessonsForMember]);

  // Create or update a single lesson occurrence for a member
  const upsertLessonForMember = async (occurrenceLocalDate: Date, hhmm: string, memberId: string) => {
    const [hStr, mStr] = (hhmm || '00:00').split(':');
    const h = Number(hStr || 0);
    const mi = Number(mStr || 0);
    // Persist the exact instant corresponding to Europe/Istanbul local time
    // Turkey is UTC+3 year-round (no DST), so offsetMinutes = 180
    const offsetMinutes = 180;
    const epochMs = Date.UTC(
      occurrenceLocalDate.getFullYear(),
      occurrenceLocalDate.getMonth(),
      occurrenceLocalDate.getDate(),
      h,
      mi,
      0,
      0,
    ) - offsetMinutes * 60 * 1000;
    const lessonTimeUTC = new Date(epochMs);
    const lessonsRef = collection(db, 'lessons');
    const qL = query(lessonsRef, where('date', '==', lessonTimeUTC));
    const snap = await getDocs(qL);
    if (!snap.empty) {
      const existingId = snap.docs[0].id;
      await updateDoc(doc(db, 'lessons', existingId), {
        memberIds: arrayUnion(memberId),
        updatedAt: serverTimestamp(),
      });
      return existingId;
    } else {
      const newRef = doc(lessonsRef);
      await setDoc(newRef, {
        date: lessonTimeUTC,
        memberIds: [memberId],
        attendedMemberIds: [],
        walkInMemberIds: [],
        createdAt: serverTimestamp(),
      });
      return newRef.id;
    }
  };

  // Build all local Date occurrences between start..end matching selected weekdays
  const buildOccurrences = (startStr: string, endStr: string, weekdays: number[]): Date[] => {
    const start = parseYMD(startStr);
    const end = parseYMD(endStr);
    if (!start || !end) return [];
    if (end < start) return [];
    const wd = new Set(weekdays);
    const out: Date[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cur <= end) {
      if (wd.has(cur.getDay())) {
        out.push(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };

  const handleCreateRecurring = async () => {
    setSaveError(null);
    if (!recurringMemberId) {
      setSaveError('Lütfen bir üye seçin.');
      return;
    }
    if (!recurringTime) {
      setSaveError('Lütfen bir saat seçin.');
      return;
    }
    if (recurringWeekdays.length === 0) {
      setSaveError('Lütfen en az bir gün seçin.');
      return;
    }
    const endToUse = recurringEnd || suggestedEnd;
    if (!recurringStart || !endToUse) {
      setSaveError('Lütfen başlangıç ve bitiş tarihi girin (veya paket bitişini kullanın).');
      return;
    }
    const occurrences = buildOccurrences(recurringStart, endToUse, recurringWeekdays);
    if (occurrences.length === 0) {
      setSaveError('Seçilen aralıkta uygun gün bulunamadı.');
      return;
    }
    setCreatingRecurring(true);
    try {
      for (const d of occurrences) {
        await upsertLessonForMember(d, recurringTime, recurringMemberId);
      }
      await fetchLessonsForMember(recurringMemberId);
    } catch (e: unknown) {
      console.error('Randevu oluşturma hatası:', e);
      const message = e instanceof Error ? e.message : String(e);
      setSaveError('Bazı randevular oluşturulurken hata oluştu: ' + message);
      return;
    } finally {
      setCreatingRecurring(false);
    }
  };

  // Remove selected member from a specific lesson (deletes the appointment for that member)
  const handleDeleteMemberLesson = async (lessonId: string) => {
    if (!recurringMemberId || !lessonId) return;
    try {
      await updateDoc(doc(db, 'lessons', lessonId), {
        memberIds: arrayRemove(recurringMemberId),
        updatedAt: serverTimestamp(),
      });
      // After removal, if lesson has no assigned or walk-in members, delete the orphan lesson
      try {
        const snap = await getDoc(doc(db, 'lessons', lessonId));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const mIds = Array.isArray((data as any).memberIds) ? ((data as any).memberIds as string[]) : [];
          const wIds = Array.isArray((data as any).walkInMemberIds) ? ((data as any).walkInMemberIds as string[]) : [];
          if (mIds.length === 0 && wIds.length === 0) {
            await deleteDoc(doc(db, 'lessons', lessonId));
          }
        }
      } catch (e) {
        // best-effort cleanup; ignore
        console.warn('Orphan cleanup skipped:', e);
      }
      setMemberLessons(prev => prev.filter(l => l.id !== lessonId));
    } catch (e) {
      console.error('Randevu silinemedi:', e);
      setSaveError('Randevu silinemedi.');
    }
  };

  return (
    <div className="appointments-page space-y-3">
      <div className="bg-white rounded-lg shadow-card p-3">
        <h3 className="text-sm font-semibold text-gray-700">Üyeye Tekrarlayan Randevu Planla</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 min-w-24">Üye:</label>
            <select
              className="border rounded px-2 py-1 text-sm w-full"
              value={recurringMemberId}
              onChange={(e) => setRecurringMemberId(e.target.value)}
            >
              <option value="">Üye seçin...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name} {m.surname}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 min-w-24">Saat:</label>
            <input
              type="time"
              step={freeEdit ? 60 : 1800}
              value={recurringTime}
              onChange={(e) => setRecurringTime(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm ml-2">
              <input type="checkbox" checked={freeEdit} onChange={(e) => setFreeEdit(e.target.checked)} />
              Serbest düzenle
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Günler:</label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-sm">
              {[
                { d: 1, label: 'Pzt' },
                { d: 2, label: 'Sal' },
                { d: 3, label: 'Çar' },
                { d: 4, label: 'Per' },
                { d: 5, label: 'Cum' },
                { d: 6, label: 'Cmt' },
                { d: 0, label: 'Paz' },
              ].map(({ d, label }) => (
                <label key={d} className={`flex items-center gap-2 border rounded px-2 py-1 ${recurringWeekdays.includes(d) ? 'bg-primary/10 border-primary' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    checked={recurringWeekdays.includes(d)}
                    onChange={(e) => {
                      setRecurringWeekdays(prev => e.target.checked ? [...prev, d] : prev.filter(x => x !== d));
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 min-w-24">Başlangıç:</label>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={recurringStart}
              onChange={(e) => setRecurringStart(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 min-w-24">Bitiş:</label>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={recurringEnd}
              onChange={(e) => setRecurringEnd(e.target.value)}
            />
            {suggestedEnd && (
              <button
                type="button"
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                onClick={() => setRecurringEnd(suggestedEnd)}
                title={`Paket bitişini kullan (${suggestedEnd})`}
              >
                Paket bitişini kullan
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-600">Not: Var olan derslere üye eklenir; yoksa yeni ders oluşturulur.</p>
          <button
            onClick={handleCreateRecurring}
            disabled={creatingRecurring || !recurringMemberId}
            className="px-4 py-2 rounded-md bg-primary text-white text-sm disabled:opacity-50"
          >
            {creatingRecurring ? 'Oluşturuluyor...' : 'Randevuları Oluştur'}
          </button>
        </div>
        {saveError && <p className="text-red-600 mt-2" role="alert">{saveError}</p>}
      </div>

      {recurringMemberId && (
        <div className="bg-white rounded-lg shadow-card p-3 mt-3">
          <h3 className="text-sm font-semibold text-gray-700">Seçili Üyenin Randevuları</h3>
          <div className="mt-2">
            {loadingMemberLessons ? (
              <p className="text-gray-600 text-sm">Yükleniyor...</p>
            ) : memberLessons.length === 0 ? (
              <p className="text-gray-600 text-sm">Bu üyenin kayıtlı randevusu yok.</p>
            ) : (
              <ul className="divide-y divide-border">
                {memberLessons.map((l) => (
                  <li key={l.id} className="py-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-800">{formatLessonUTC(l.date)}</span>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 border rounded text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDeleteMemberLesson(l.id)}
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
