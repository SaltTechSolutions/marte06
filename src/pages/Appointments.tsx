import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Member } from '../components/MemberList';
import { collection, query, where, getDocs, getDoc, doc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, onSnapshot, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Helper to compute the exact UTC Date stored for a given local date and HH:mm (Europe/Istanbul, UTC+3)
const computeLessonUTCForOccurrence = (occurrenceLocalDate: Date, hhmm: string): Date => {
  const [hStr, mStr] = (hhmm || '00:00').split(':');
  const h = Number(hStr || 0);
  const mi = Number(mStr || 0);
  const offsetMinutes = 180; // UTC+3
  const epochMs = Date.UTC(
    occurrenceLocalDate.getFullYear(),
    occurrenceLocalDate.getMonth(),
    occurrenceLocalDate.getDate(),
    h,
    mi,
    0,
    0,
  ) - offsetMinutes * 60 * 1000;
  return new Date(epochMs);
};

const Appointments: React.FC = () => {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  // Turkish alphabetical sorting for members (name + surname)
  const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        collator.compare(`${a.name ?? ''} ${a.surname ?? ''}`.trim(), `${b.name ?? ''} ${b.surname ?? ''}`.trim()),
      ),
    [members, collator],
  );
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
  const [remainingLessons, setRemainingLessons] = useState<number | null>(null);
  const [suggestedPkgLabel, setSuggestedPkgLabel] = useState<string>('');
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

  // Compute remaining lessons for the active/latest package of the selected member
  const fetchRemainingLessons = useCallback(async (memberId: string) => {
    if (!memberId) {
      setRemainingLessons(null);
      return;
    }
    try {
      const qAP = query(collection(db, 'assigned_packages'), where('memberId', '==', memberId));
      const snap = await getDocs(qAP);
      if (snap.empty) { setRemainingLessons(null); return; }

      // Choose active package (now between start..end) else fallback to the one with latest end
      const now = new Date();
      type APRow = { id: string; startDate?: any; endDate?: any; totalLessonCount?: number | null };
      const rows: APRow[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const withDates = rows.map(r => ({
        ...r,
        start: r.startDate && typeof r.startDate.toDate === 'function' ? r.startDate.toDate() as Date : null,
        end: r.endDate && typeof r.endDate.toDate === 'function' ? r.endDate.toDate() as Date : null,
      }));
      let target = withDates.find(r => r.start && r.end && r.start <= now && now <= r.end) || null;
      if (!target) {
        let latestEndMs = -1;
        withDates.forEach(r => {
          const ms = r.end ? r.end.getTime() : -1;
          if (ms > latestEndMs) { latestEndMs = ms; target = r; }
        });
      }
      if (!target || !target.start) { setRemainingLessons(null); return; }

      const total = Number(target.totalLessonCount || 0);
      if (!Number.isFinite(total) || total <= 0) { setRemainingLessons(null); return; }
      // Normalize date bounds to full days
      const start = target.start as Date;
      const end = (target.end as Date) || now;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

      // Prefer ranged query (may require composite index); fallback to non-ranged if unavailable
      let attended = 0;
      try {
        const qLr = query(
          collection(db, 'lessons'),
          where('memberIds', 'array-contains', memberId),
          where('date', '>=', Timestamp.fromDate(startDay)),
          where('date', '<=', Timestamp.fromDate(endDay)),
        );
        const lSnap = await getDocs(qLr);
        lSnap.forEach(d => {
          const raw = d.data() as any;
          const attendedIds: string[] = Array.isArray(raw?.attendedMemberIds) ? raw.attendedMemberIds : [];
          if (attendedIds.includes(memberId)) attended += 1;
        });
      } catch (rangeErr) {
        // Fallback: broader query, client-side filter
        const qL = query(collection(db, 'lessons'), where('memberIds', 'array-contains', memberId));
        const lSnap = await getDocs(qL);
        lSnap.forEach(d => {
          const raw = d.data() as any;
          const ts = raw?.date;
          const dt: Date | null = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
          if (!dt) return;
          if (dt < startDay || dt > endDay) return;
          const attendedIds: string[] = Array.isArray(raw?.attendedMemberIds) ? raw.attendedMemberIds : [];
          if (attendedIds.includes(memberId)) attended += 1;
        });
      }
      const remaining = Math.max(0, total - attended);
      setRemainingLessons(remaining);
    } catch (e) {
      console.error('Kalan ders hesaplanamadı:', e);
      setRemainingLessons(null);
    }
  }, []);

  useEffect(() => {
    fetchRemainingLessons(recurringMemberId);
  }, [recurringMemberId, fetchRemainingLessons]);

  // Build a label like "Paket Adı (dd.mm.yyyy – dd.mm.yyyy)" for the active/latest package
  const fetchSuggestedPackageLabel = useCallback(async (memberId: string) => {
    if (!memberId) { setSuggestedPkgLabel(''); return; }
    try {
      const qAP = query(collection(db, 'assigned_packages'), where('memberId', '==', memberId));
      const snap = await getDocs(qAP);
      if (snap.empty) { setSuggestedPkgLabel(''); return; }

      const now = new Date();
      type APRow = { id: string; startDate?: any; endDate?: any; packageId?: string; packageName?: string };
      const rows: APRow[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const withDates = rows.map(r => ({
        ...r,
        start: r.startDate && typeof (r.startDate as any).toDate === 'function' ? (r.startDate as any).toDate() as Date : null,
        end: r.endDate && typeof (r.endDate as any).toDate === 'function' ? (r.endDate as any).toDate() as Date : null,
      }));
      let target = withDates.find(r => r.start && r.end && r.start <= now && now <= r.end) || null;
      if (!target) {
        let latestEndMs = -1;
        withDates.forEach(r => {
          const ms = r.end ? r.end.getTime() : -1;
          if (ms > latestEndMs) { latestEndMs = ms; target = r; }
        });
      }
      if (!target || !target.start || !target.end) { setSuggestedPkgLabel(''); return; }

      let pkgName = (target as any).packageName as string | undefined;
      const pkgId = (target as any).packageId as string | undefined;
      if (!pkgName && pkgId) {
        try {
          const pSnap = await getDoc(doc(db, 'packages', pkgId));
          pkgName = (pSnap.exists() ? (pSnap.data() as any)?.name : '') || '';
        } catch {
          pkgName = '';
        }
      }

      const startText = (target.start as Date).toLocaleDateString('tr-TR');
      const endText = (target.end as Date).toLocaleDateString('tr-TR');
      const label = `${pkgName ? pkgName + ' ' : ''}(${startText} – ${endText})`;
      setSuggestedPkgLabel(label);
    } catch (e) {
      console.error('Paket etiketi oluşturulamadı:', e);
      setSuggestedPkgLabel('');
    }
  }, []);

  useEffect(() => {
    fetchSuggestedPackageLabel(recurringMemberId);
  }, [recurringMemberId, fetchSuggestedPackageLabel]);

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

  // Live updates: when lessons change for the selected member, refresh lessons list and remaining lessons
  useEffect(() => {
    if (!recurringMemberId) return;
    const qL = query(collection(db, 'lessons'), where('memberIds', 'array-contains', recurringMemberId));
    const unsub = onSnapshot(qL, () => {
      fetchLessonsForMember(recurringMemberId);
      fetchRemainingLessons(recurringMemberId);
    });
    return () => unsub();
  }, [recurringMemberId, fetchLessonsForMember, fetchRemainingLessons]);

  // Live updates: when assigned packages change for the selected member, refresh suggested end and remaining lessons
  useEffect(() => {
    if (!recurringMemberId) return;
    const qAP = query(collection(db, 'assigned_packages'), where('memberId', '==', recurringMemberId));
    const unsub = onSnapshot(qAP, () => {
      fetchActivePackageEnd(recurringMemberId);
      fetchRemainingLessons(recurringMemberId);
      fetchSuggestedPackageLabel(recurringMemberId);
    });
    return () => unsub();
  }, [recurringMemberId, fetchActivePackageEnd, fetchRemainingLessons, fetchSuggestedPackageLabel]);

  // (removed) upsertLessonForMember — replaced by batched writes in handleCreateRecurring

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
    // Guard: Do not allow scheduling beyond suggested package end
    if (suggestedEnd && recurringEnd) {
      const recEnd = parseYMD(recurringEnd);
      const sugEnd = parseYMD(suggestedEnd);
      if (recEnd && sugEnd && recEnd > sugEnd) {
        setSaveError('Seçilen bitiş tarihi paket bitişinden sonra olamaz.');
        return;
      }
    }
    if (!recurringStart || !endToUse) {
      setSaveError('Lütfen başlangıç ve bitiş tarihi girin (veya paket bitişini kullanın).');
      return;
    }
    let occurrences = buildOccurrences(recurringStart, endToUse, recurringWeekdays);
    if (occurrences.length === 0) {
      setSaveError('Seçilen aralıkta uygun gün bulunamadı.');
      return;
    }
    // Cap by remaining lessons if available
    let capNotice: string | null = null;
    if (typeof remainingLessons === 'number') {
      if (remainingLessons <= 0) {
        setSaveError('Kalan ders yok. Randevu oluşturulamadı.');
        return;
      }
      if (occurrences.length > remainingLessons) {
        occurrences = occurrences.slice(0, remainingLessons);
        capNotice = `Kalan ders sayısına göre ${occurrences.length} randevu oluşturulacak.`;
      }
    }
    setCreatingRecurring(true);
    try {
      // Preload existing lessons in the UTC date range and batch writes
      const utcDates = occurrences.map(d => computeLessonUTCForOccurrence(d, recurringTime));
      const minUTC = new Date(Math.min(...utcDates.map(d => d.getTime())));
      const maxUTC = new Date(Math.max(...utcDates.map(d => d.getTime())));
      const lessonsRef = collection(db, 'lessons');
      const qExisting = query(lessonsRef, where('date', '>=', Timestamp.fromDate(minUTC)), where('date', '<=', Timestamp.fromDate(maxUTC)));
      const existingSnap = await getDocs(qExisting);
      const byTime = new Map<number, { id: string; memberIds: string[] }>();
      existingSnap.forEach(docSnap => {
        const data = docSnap.data() as any;
        const dt = data?.date && typeof data.date.toDate === 'function' ? (data.date.toDate() as Date) : null;
        if (!dt) return;
        byTime.set(dt.getTime(), { id: docSnap.id, memberIds: Array.isArray(data.memberIds) ? data.memberIds : [] });
      });

      const batch = writeBatch(db);
      for (const utc of utcDates) {
        const key = utc.getTime();
        const match = byTime.get(key);
        if (match) {
          // Update existing lesson: add member if not already present
          batch.update(doc(db, 'lessons', match.id), {
            memberIds: arrayUnion(recurringMemberId),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Create new lesson
          const newRef = doc(lessonsRef);
          batch.set(newRef, {
            date: Timestamp.fromDate(utc),
            memberIds: [recurringMemberId],
            attendedMemberIds: [],
            walkInMemberIds: [],
            createdAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      await fetchLessonsForMember(recurringMemberId);
      await fetchRemainingLessons(recurringMemberId);
      if (capNotice) setSaveError(capNotice);
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
    <div className="appointments-page space-y-3 px-3 sm:px-4 pb-2">
      <div className="bg-white rounded-lg shadow-card p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-700">Üyeye Tekrarlayan Randevu Planla</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="text-sm sm:text-base text-gray-700 min-w-24">Üye:</label>
            <select
              className="border rounded px-3 py-2 text-base h-11 w-full"
              value={recurringMemberId}
              onChange={(e) => setRecurringMemberId(e.target.value)}
            >
              <option value="">Üye seçin...</option>
              {sortedMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name} {m.surname}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <label className="text-sm sm:text-base text-gray-700 min-w-24">Saat:</label>
            <input
              type="time"
              step={freeEdit ? 60 : 1800}
              value={recurringTime}
              onChange={(e) => setRecurringTime(e.target.value)}
              className="border rounded px-3 py-2 text-base h-11"
            />
            <label className="inline-flex items-center gap-2 text-sm sm:text-base ml-2">
              <input type="checkbox" checked={freeEdit} onChange={(e) => setFreeEdit(e.target.checked)} />
              Serbest düzenle
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm sm:text-base font-medium text-gray-700">Günler:</label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3 text-sm">
              {[
                { d: 1, label: 'Pzt' },
                { d: 2, label: 'Sal' },
                { d: 3, label: 'Çar' },
                { d: 4, label: 'Per' },
                { d: 5, label: 'Cum' },
                { d: 6, label: 'Cmt' },
                { d: 0, label: 'Paz' },
              ].map(({ d, label }) => (
                <label key={d} className={`flex items-center justify-center gap-2 border rounded-lg px-3 py-2 min-h-11 cursor-pointer select-none ${recurringWeekdays.includes(d) ? 'bg-primary/10 border-primary' : 'border-border'}`}>
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
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="text-sm sm:text-base text-gray-700 min-w-24">Başlangıç:</label>
            <input
              type="date"
              className="border rounded px-3 py-2 text-base h-11"
              value={recurringStart}
              onChange={(e) => setRecurringStart(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="text-sm sm:text-base text-gray-700 min-w-24">Bitiş:</label>
            <input
              type="date"
              className="border rounded px-3 py-2 text-base h-11"
              value={recurringEnd}
              onChange={(e) => setRecurringEnd(e.target.value)}
            />
            {suggestedEnd && (
              <button
                type="button"
                className="text-xs sm:text-sm px-3 py-2 border rounded hover:bg-gray-50"
                onClick={() => setRecurringEnd(suggestedEnd)}
                title={`Paket bitişini kullan (${suggestedEnd})`}
              >
                Paket bitişini kullan
              </button>
            )}
          </div>
          <div className="md:col-start-2">
            {suggestedPkgLabel && (
              <div className="text-xs sm:text-sm text-gray-600">{suggestedPkgLabel}</div>
            )}
            {typeof remainingLessons === 'number' && (
              <div className="mt-1 text-xs sm:text-sm text-gray-600">Kalan ders: {remainingLessons}</div>
            )}
          </div>
        </div>
        {recurringMemberId && (
          <div className="mt-2 text-xs sm:text-sm text-amber-700">
            {!suggestedPkgLabel
              ? 'Seçili üyenin atanmış paketi bulunamadı. Paket atanmadan planlama yaparken kalan ders ile sınırlandırma uygulanamaz.'
              : typeof remainingLessons !== 'number'
                ? 'Bu paketin toplam ders sayısı tanımlı değil. Kalan ders hesaplanamıyor; paketi güncelleyebilirsiniz.'
                : null}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-gray-600">Not: Var olan derslere üye eklenir; yoksa yeni ders oluşturulur.</p>
          <button
            onClick={handleCreateRecurring}
            disabled={creatingRecurring || !recurringMemberId}
            className="h-11 px-4 rounded-md bg-primary text-white text-sm sm:text-base disabled:opacity-50"
          >
            {creatingRecurring ? 'Oluşturuluyor...' : 'Randevuları Oluştur'}
          </button>
        </div>
        {saveError && <p className="text-red-600 mt-2" role="alert">{saveError}</p>}
      </div>

      {recurringMemberId && (
        <div className="bg-white rounded-lg shadow-card p-3 sm:p-4 mt-3">
          <h3 className="text-sm sm:text-base font-semibold text-gray-700">Seçili Üyenin Randevuları</h3>
          <div className="mt-2">
            {loadingMemberLessons ? (
              <p className="text-gray-600 text-sm">Yükleniyor...</p>
            ) : memberLessons.length === 0 ? (
              <p className="text-gray-600 text-sm">Bu üyenin kayıtlı randevusu yok.</p>
            ) : (
              <ul className="divide-y divide-border">
                {memberLessons.map((l) => (
                  <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                    <span className="text-sm sm:text-base text-gray-800">{formatLessonUTC(l.date)}</span>
                    <button
                      type="button"
                      className="text-sm px-3 py-2 border rounded text-red-600 border-red-200 hover:bg-red-50"
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
