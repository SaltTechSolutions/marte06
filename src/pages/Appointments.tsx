import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { createChunkedBatch } from '../utils/firestoreBatch';
import { useMembers, type Member } from '../hooks/useMembers';
import { toJSDate, TZ } from '../utils/dateHelpers';
import { useAssignedPackages } from '../hooks/useAssignedPackages';
import { useMemberLessons } from '../hooks/useMemberLessons';
import { AppShell, Header, BottomNav, Card, Input, Select, Button } from '../design-system/components';
import { FiClock, FiCalendar, FiTrash2, FiAlertCircle } from 'react-icons/fi';

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

  const memberOptions = sortedMembers.map(m => ({
    value: m.id,
    label: `${m.name} ${m.surname}`
  }));

  // Clean, dark mode adaptive day styles
  const dayPills = [
    { d: 1, label: 'Pzt', checkedClass: 'bg-blue-600 text-white dark:bg-blue-500', uncheckedClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' },
    { d: 2, label: 'Sal', checkedClass: 'bg-indigo-600 text-white dark:bg-indigo-500', uncheckedClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400' },
    { d: 3, label: 'Çar', checkedClass: 'bg-purple-600 text-white dark:bg-purple-500', uncheckedClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400' },
    { d: 4, label: 'Per', checkedClass: 'bg-pink-600 text-white dark:bg-pink-500', uncheckedClass: 'bg-pink-50 text-pink-700 dark:bg-pink-950/20 dark:text-pink-400' },
    { d: 5, label: 'Cum', checkedClass: 'bg-amber-600 text-white dark:bg-amber-500', uncheckedClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' },
    { d: 6, label: 'Cmt', checkedClass: 'bg-emerald-600 text-white dark:bg-emerald-500', uncheckedClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' },
    { d: 0, label: 'Paz', checkedClass: 'bg-cyan-600 text-white dark:bg-cyan-500', uncheckedClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400' },
  ];

  return (
    <AppShell
      header={<Header title="Tekrarlayan Randevular" />}
      bottomNav={<BottomNav />}
    >
      <div className="p-4 pb-[calc(var(--bottom-nav-height)+1.5rem)] max-w-2xl mx-auto space-y-6">
        
        {/* Scheduler Form Card */}
        <Card variant="elevated" className="!p-5 space-y-5">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-[var(--color-primary)]" size={20} />
            <h3 className="text-lg font-bold text-[var(--color-text)]">Tekrarlayan Randevu Planla</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Üye *"
              placeholder="Üye seçin..."
              options={memberOptions}
              value={recurringMemberId}
              onChange={(e) => setRecurringMemberId(e.target.value)}
              fullWidth
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Saat *</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={freeEdit}
                    onChange={(e) => setFreeEdit(e.target.checked)}
                    className="rounded text-[var(--color-primary)] focus:ring-0 border-[var(--color-border)] bg-transparent"
                  />
                  <span>Serbest Düzenle</span>
                </label>
              </div>
              <Input
                type="time"
                step={freeEdit ? 60 : 1800}
                value={recurringTime}
                onChange={(e) => setRecurringTime(e.target.value)}
                fullWidth
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Günler *</label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {dayPills.map(({ d, label, checkedClass, uncheckedClass }) => {
                  const checked = recurringWeekdays.includes(d);
                  const id = `weekday-${d}`;
                  return (
                    <div key={d} className="relative">
                      <input
                        id={id}
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) =>
                          setRecurringWeekdays((prev) =>
                            e.target.checked ? [...prev, d] : prev.filter((x) => x !== d)
                          )
                        }
                      />
                      <label
                        htmlFor={id}
                        className={`flex items-center justify-center h-10 w-full rounded-xl text-xs font-semibold select-none shadow-sm cursor-pointer border border-transparent transition-all duration-200 active:scale-95 ${
                          checked ? checkedClass : `${uncheckedClass} border-[var(--color-border)]`
                        }`}
                      >
                        {label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <Input
              type="date"
              label="Başlangıç Tarihi *"
              value={recurringStart}
              onChange={(e) => setRecurringStart(e.target.value)}
              fullWidth
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Bitiş Tarihi *</label>
                {suggestedEnd && (
                  <button
                    type="button"
                    className="text-xs text-[var(--color-primary-600)] hover:underline bg-transparent border-none p-0 cursor-pointer"
                    onClick={() => setRecurringEnd(suggestedEnd)}
                  >
                    Paket bitişini kullan
                  </button>
                )}
              </div>
              <Input
                type="date"
                value={recurringEnd}
                onChange={(e) => setRecurringEnd(e.target.value)}
                fullWidth
              />
            </div>
          </div>

          {/* Package Info Helper */}
          {recurringMemberId && (suggestedPkgLabel || typeof remainingLessons === 'number') && (
            <div className="p-3 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl text-xs space-y-1 text-[var(--color-text-secondary)]">
              {suggestedPkgLabel && (
                <p>
                  <strong>Aktif Paket:</strong> {suggestedPkgLabel}
                </p>
              )}
              {typeof remainingLessons === 'number' && (
                <p>
                  <strong>Kalan Ders Hakki:</strong> {remainingLessons}
                </p>
              )}
            </div>
          )}

          {/* Warnings */}
          {recurringMemberId && !suggestedPkgLabel && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs text-amber-800 dark:text-amber-400">
              <FiAlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>Seçili üyenin aktif paketi bulunamadı. Kalan ders sınırlandırması uygulanamaz.</p>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl text-xs text-red-700 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[var(--color-text-muted)] max-w-[60%]">
              * Mevcut saatteki derslere üye eklenir, ders yoksa otomatik oluşturulur.
            </span>
            <Button
              onClick={handleCreateRecurring}
              loading={creatingRecurring}
              disabled={!recurringMemberId}
              variant="primary"
            >
              Randevuları Oluştur
            </Button>
          </div>
        </Card>

        {/* Existing Appointments List Card */}
        {recurringMemberId && (
          <Card variant="elevated" className="!p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FiClock className="text-[var(--color-primary)]" size={20} />
              <h3 className="text-lg font-bold text-[var(--color-text)]">Üyenin Güncel Randevuları</h3>
            </div>

            {loadingMemberLessons ? (
              <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">Yükleniyor...</p>
            ) : memberLessons.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">Bu üyenin planlanmış randevusu bulunmuyor.</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)] max-h-80 overflow-y-auto pr-1">
                {memberLessons.map((l) => (
                  <div key={l.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                    <span className="text-sm font-medium text-[var(--color-text)]">{formatLessonUTC(l.date)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromLesson(l.id)}
                      className="!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950/30"
                      leftIcon={<FiTrash2 />}
                    >
                      Sil
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default Appointments;
