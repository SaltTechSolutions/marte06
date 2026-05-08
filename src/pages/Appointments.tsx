import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { createChunkedBatch } from '../utils/firestoreBatch';
import { useMembers, type Member } from '../hooks/useMembers';
import { toJSDate, TZ } from '../utils/dateHelpers';
import { useAssignedPackages } from '../hooks/useAssignedPackages';
import { useMemberLessons } from '../hooks/useMemberLessons';

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

// Helper: parse YYYY-MM-DD to Date (local)
const parseYMD = (str: string): Date | null => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if ([y, m, d].some(n => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d);
};

// Format lesson time in Europe/Istanbul for consistent display
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

const Appointments: React.FC = () => {
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Real-time members data with sorting
  const { members, sortedMembers } = useMembers(true);
  
  const [freeEdit, setFreeEdit] = useState<boolean>(false);
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
  const [creatingRecurring, setCreatingRecurring] = useState<boolean>(false);

  // Hook for lessons
  const { lessons: memberLessons, loading: loadingMemberLessons, removeFromLesson } = useMemberLessons({ memberId: recurringMemberId, realtime: true });

  // Hook for assigned packages
  const { assignedPackages, activePackage } = useAssignedPackages({ memberId: recurringMemberId, realtime: true, fetchLessonCounts: true });

  // Compute package states
  // We use activePackage or the one with the latest endDate if no active package
  let targetPackage = activePackage;
  if (!targetPackage && assignedPackages.length > 0) {
    targetPackage = assignedPackages.reduce((latest, pkg) => {
      const latestEnd = toJSDate(latest.endDate)?.getTime() || 0;
      const pkgEnd = toJSDate(pkg.endDate)?.getTime() || 0;
      return pkgEnd > latestEnd ? pkg : latest;
    }, assignedPackages[0]);
  }

  const suggestedEndObj = targetPackage ? toJSDate(targetPackage.endDate) : null;
  const suggestedEnd = suggestedEndObj ? `${suggestedEndObj.getFullYear()}-${String(suggestedEndObj.getMonth() + 1).padStart(2, '0')}-${String(suggestedEndObj.getDate()).padStart(2, '0')}` : '';
  const remainingLessons = targetPackage ? targetPackage.remainingLessons : null;
  
  const suggestedPkgLabel = targetPackage 
    ? `${targetPackage.packageName} (${toJSDate(targetPackage.startDate)?.toLocaleDateString('tr-TR')} – ${suggestedEndObj?.toLocaleDateString('tr-TR') || 'Süresiz'})`
    : '';

  useEffect(() => {
    if (suggestedEnd && !recurringEnd) {
      setRecurringEnd(suggestedEnd);
    }
  }, [suggestedEnd, recurringEnd]);

  useEffect(() => {
    // Reset selections on member change
    setRecurringWeekdays([]);
    setRecurringTime('08:00');
    setSaveError(null);
  }, [recurringMemberId]);

  const buildOccurrences = (startStr: string, endStr: string, weekdays: number[]): Date[] => {
    const start = parseYMD(startStr);
    const end = parseYMD(endStr);
    if (!start || !end || end < start) return [];
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
    if (!recurringMemberId) return setSaveError('Lütfen bir üye seçin.');
    if (!recurringTime) return setSaveError('Lütfen bir saat seçin.');
    if (recurringWeekdays.length === 0) return setSaveError('Lütfen en az bir gün seçin.');
    
    const endToUse = recurringEnd || suggestedEnd;
    if (suggestedEnd && recurringEnd) {
      const recEnd = parseYMD(recurringEnd);
      const sugEnd = parseYMD(suggestedEnd);
      if (recEnd && sugEnd && recEnd > sugEnd) {
        return setSaveError('Seçilen bitiş tarihi paket bitişinden sonra olamaz.');
      }
    }
    if (!recurringStart || !endToUse) return setSaveError('Lütfen başlangıç ve bitiş tarihi girin.');
    
    let occurrences = buildOccurrences(recurringStart, endToUse, recurringWeekdays);
    if (occurrences.length === 0) return setSaveError('Seçilen aralıkta uygun gün bulunamadı.');
    
    let capNotice: string | null = null;
    if (typeof remainingLessons === 'number') {
      if (remainingLessons <= 0) return setSaveError('Kalan ders yok. Randevu oluşturulamadı.');
      if (occurrences.length > remainingLessons) {
        occurrences = occurrences.slice(0, remainingLessons);
        capNotice = `Seçilen tarih aralığındaki dersler, kalan ders sayısı (${remainingLessons}) ile sınırlandırıldı.`;
      }
    }

    setCreatingRecurring(true);
    try {
      const utcDates = occurrences.map((localDate) => computeLessonUTCForOccurrence(localDate, recurringTime));
      const minUTC = new Date(Math.min(...utcDates.map((d) => d.getTime())));
      const maxUTC = new Date(Math.max(...utcDates.map((d) => d.getTime())));

      const lessonsRef = collection(db, 'lessons');
      const qExisting = query(
        lessonsRef,
        where('date', '>=', Timestamp.fromDate(minUTC)),
        where('date', '<=', Timestamp.fromDate(maxUTC))
      );
      const existingSnap = await getDocs(qExisting);
      const byTime = new Map<number, { id: string }>();
      existingSnap.forEach((docSnap) => {
        const dt = toJSDate(docSnap.data()?.date);
        if (dt) byTime.set(dt.getTime(), { id: docSnap.id });
      });

      const selectedMember = members.find((m) => m.id === recurringMemberId) as (Member & { memberUid?: string }) | undefined;
      const selectedMemberUid = selectedMember?.memberUid;

      const batch = createChunkedBatch();
      for (const utc of utcDates) {
        const key = utc.getTime();
        const match = byTime.get(key);
        if (match) {
          batch.update(doc(db, 'lessons', match.id), {
            memberIds: arrayUnion(recurringMemberId),
            ...(selectedMemberUid ? { memberUids: arrayUnion(selectedMemberUid) } : {}),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(doc(lessonsRef), {
            date: Timestamp.fromDate(utc),
            memberIds: [recurringMemberId],
            ...(selectedMemberUid ? { memberUids: [selectedMemberUid] } : {}),
            attendedMemberIds: [],
            walkInMemberIds: [],
            ...(selectedMemberUid ? { attendedMemberUids: [], walkInMemberUids: [] } : {}),
            createdAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      if (capNotice) setSaveError(capNotice);
    } catch (e: any) {
      console.error('Randevu oluşturma hatası:', e);
      setSaveError('Bazı randevular oluşturulurken hata oluştu: ' + e.message);
    } finally {
      setCreatingRecurring(false);
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
            <div className="mt-2 grid grid-cols-2 gap-[5px] text-sm">
              {[
                { d: 1, label: 'Pzt', inactiveBg: '#bfdbfe', inactiveText: '#0b3b8a', activeBg: '#2563eb', activeText: '#ffffff' },
                { d: 2, label: 'Sal', inactiveBg: '#c7d2fe', inactiveText: '#1e1b4b', activeBg: '#4f46e5', activeText: '#ffffff' },
                { d: 3, label: 'Çar', inactiveBg: '#e9d5ff', inactiveText: '#3b0764', activeBg: '#7c3aed', activeText: '#ffffff' },
                { d: 4, label: 'Per', inactiveBg: '#fbcfe8', inactiveText: '#831843', activeBg: '#db2777', activeText: '#ffffff' },
                { d: 5, label: 'Cum', inactiveBg: '#fde68a', inactiveText: '#78350f', activeBg: '#d97706', activeText: '#111827' },
                { d: 6, label: 'Cmt', inactiveBg: '#a7f3d0', inactiveText: '#064e3b', activeBg: '#10b981', activeText: '#064e3b' },
                { d: 0, label: 'Paz', inactiveBg: '#a5f3fc', inactiveText: '#083344', activeBg: '#06b6d4', activeText: '#083344' },
              ].map(({ d, label, inactiveBg, inactiveText, activeBg, activeText }) => {
                const checked = recurringWeekdays.includes(d);
                const id = `weekday-${d}`;
                return (
                  <div key={d} className="w-full">
                    <input
                      id={id}
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => setRecurringWeekdays((prev) => e.target.checked ? [...prev, d] : prev.filter((x) => x !== d))}
                    />
                    <label
                      htmlFor={id}
                      className="inline-flex items-center justify-center h-11 w-full rounded-full px-4 font-semibold select-none shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors"
                      style={{ backgroundColor: checked ? activeBg : inactiveBg, color: checked ? activeText : inactiveText }}
                    >
                      {label}
                    </label>
                  </div>
                );
              })}
              <div className="h-11 rounded-full invisible" aria-hidden></div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="text-sm sm:text-base text-gray-700 min-w-24">Başlangıç:</label>
            <input type="date" className="border rounded px-3 py-2 text-base h-11" value={recurringStart} onChange={(e) => setRecurringStart(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="text-sm sm:text-base text-gray-700 min-w-24">Bitiş:</label>
            <input type="date" className="border rounded px-3 py-2 text-base h-11" value={recurringEnd} onChange={(e) => setRecurringEnd(e.target.value)} />
            {suggestedEnd && (
              <button type="button" className="text-xs sm:text-sm px-3 py-2 border rounded hover:bg-gray-50" onClick={() => setRecurringEnd(suggestedEnd)} title={`Paket bitişini kullan (${suggestedEnd})`}>
                Paket bitişini kullan
              </button>
            )}
          </div>
          <div className="md:col-start-2">
            {suggestedPkgLabel && <div className="text-xs sm:text-sm text-gray-600">{suggestedPkgLabel}</div>}
            {typeof remainingLessons === 'number' && <div className="mt-1 text-xs sm:text-sm text-gray-600">Kalan ders: {remainingLessons}</div>}
          </div>
        </div>
        {recurringMemberId && (
          <div className="mt-2 text-xs sm:text-sm text-amber-700">
            {!suggestedPkgLabel ? 'Seçili üyenin atanmış paketi bulunamadı. Paket atanmadan planlama yaparken kalan ders ile sınırlandırma uygulanamaz.' : typeof remainingLessons !== 'number' ? 'Bu paketin toplam ders sayısı tanımlı değil. Kalan ders hesaplanamıyor; paketi güncelleyebilirsiniz.' : null}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-gray-600">Not: Var olan derslere üye eklenir; yoksa yeni ders oluşturulur.</p>
          <button onClick={handleCreateRecurring} disabled={creatingRecurring || !recurringMemberId} className="h-11 px-4 rounded-md bg-primary text-white text-sm sm:text-base disabled:opacity-50">
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
                    <button type="button" className="text-sm px-3 py-2 border rounded text-red-600 border-red-200 hover:bg-red-50" onClick={() => removeFromLesson(l.id)}>
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
