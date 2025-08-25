// src/pages/MemberDashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import { auth, db } from '../firebaseConfig';
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';

interface MemberDoc {
  id: string;
  name?: string;
  surname?: string;
  email?: string;
}

interface AssignedPackageRow {
  id: string;
  packageId?: string;
  packageName?: string;
  startDate?: any;
  endDate?: any;
  totalLessonCount?: number | null;
  // Computed convenience fields used in the dashboard logic
  start?: Date | null;
  end?: Date | null;
}

interface LessonRow {
  id: string;
  date: Date;
}

const TZ = 'Europe/Istanbul';

const MemberDashboard: React.FC = () => {
  const { memberId, currentUser } = useAuth();
  const [member, setMember] = useState<MemberDoc | null>(null);
  const [activePkg, setActivePkg] = useState<AssignedPackageRow | null>(null);
  const [remainingLessons, setRemainingLessons] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fullName = useMemo(() => {
    if (!member) return '';
    return `${member.name || ''} ${member.surname || ''}`.trim();
  }, [member]);

  const formatDateRange = (start: Date | null, end: Date | null) => {
    const fmt = (d: Date | null) => (d ? d.toLocaleDateString('tr-TR') : '-');
    return `${fmt(start)} – ${fmt(end)}`;
  };

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

  useEffect(() => {
    const run = async () => {
      if (!memberId || !currentUser) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        // Fetch member doc
        console.debug('[MemberDashboard] Fetch member doc:', memberId);
        const mSnap = await getDoc(doc(db, 'members', memberId));
        if (mSnap.exists()) {
          setMember({ id: mSnap.id, ...(mSnap.data() as any) });
        } else {
          console.warn('[MemberDashboard] Member doc not found for id:', memberId);
        }
      
        // Fetch assigned packages and determine active/latest
        // Prefer UID-based query (rules require memberUid == auth.uid). Fallback to memberId for legacy data.
        let apSnap: any;
        try {
          console.debug('[MemberDashboard] Query assigned_packages by memberUid:', currentUser.uid);
          const qAPUid = query(collection(db, 'assigned_packages'), where('memberUid', '==', currentUser.uid));
          apSnap = await getDocs(qAPUid);
        } catch (e) {
          // Ignore, try legacy
          apSnap = null as any;
          console.warn('[MemberDashboard] UID assigned_packages query failed, will try legacy memberId. Error:', e);
        }
        if (!apSnap || apSnap.empty) {
          try {
            console.debug('[MemberDashboard] Query assigned_packages by memberId (legacy):', memberId);
            const qAP = query(collection(db, 'assigned_packages'), where('memberId', '==', memberId));
            apSnap = await getDocs(qAP);
          } catch (e) {
            console.warn('[MemberDashboard] Legacy assigned_packages query failed. Proceeding with empty.', e);
            apSnap = { docs: [] } as any;
          }
        }
        const now = new Date();
        const rows: AssignedPackageRow[] = apSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
        const withDates = rows.map(r => ({
          ...r,
          start: r.startDate && typeof (r.startDate as any).toDate === 'function' ? (r.startDate as any).toDate() as Date : null,
          end: r.endDate && typeof (r.endDate as any).toDate === 'function' ? (r.endDate as any).toDate() as Date : null,
        }));
        let target: any = withDates.find(r => r.start && r.end && r.start <= now && now <= r.end) || null;
        if (!target) {
          let latestEndMs = -1;
          withDates.forEach(r => {
            const ms = r.end ? r.end.getTime() : -1;
            if (ms > latestEndMs) { latestEndMs = ms; target = r; }
          });
        }
        setActivePkg(target || null);

        // Compute remaining lessons
        if (target && target.start) {
          const total = Number(target.totalLessonCount || 0);
          if (Number.isFinite(total) && total > 0) {
            const startDay = new Date(target.start.getFullYear(), target.start.getMonth(), target.start.getDate(), 0, 0, 0, 0);
            const endDay = target.end ? new Date(target.end.getFullYear(), target.end.getMonth(), target.end.getDate(), 23, 59, 59, 999) : now;
            let attended = 0;
            try {
              console.debug('[MemberDashboard] Query lessons (UID + range) for remaining');
              // Try UID-first with range
              const qL = query(
                collection(db, 'lessons'),
                where('memberUids', 'array-contains', currentUser.uid),
                where('date', '>=', Timestamp.fromDate(startDay)),
                where('date', '<=', Timestamp.fromDate(endDay)),
              );
              const lSnap = await getDocs(qL);
              lSnap.forEach(d => {
                const raw = d.data() as any;
                const attendedUids: string[] = Array.isArray(raw?.attendedMemberUids) ? raw.attendedMemberUids : [];
                // Prefer UID attendance, fallback to IDs if missing
                const attendedIds: string[] = Array.isArray(raw?.attendedMemberIds) ? raw.attendedMemberIds : [];
                if (attendedUids.includes(currentUser.uid) || attendedIds.includes(memberId)) attended += 1;
              });
            } catch (e) {
              // Fallback: no range; still UID-first then ID
              try {
                console.debug('[MemberDashboard] Fallback lessons (UID only) for remaining');
                const qL2 = query(collection(db, 'lessons'), where('memberUids', 'array-contains', currentUser.uid));
                const lSnap2 = await getDocs(qL2);
                lSnap2.forEach(d => {
                  const raw = d.data() as any;
                  const ts = raw?.date;
                  const dt: Date | null = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
                  if (!dt) return;
                  if (dt < startDay || dt > endDay) return;
                  const attendedUids: string[] = Array.isArray(raw?.attendedMemberUids) ? raw.attendedMemberUids : [];
                  const attendedIds: string[] = Array.isArray(raw?.attendedMemberIds) ? raw.attendedMemberIds : [];
                  if (attendedUids.includes(currentUser.uid) || attendedIds.includes(memberId)) attended += 1;
                });
              } catch (e2) {
                console.warn('[MemberDashboard] Lessons UID queries failed for remaining, trying legacy memberIds. Errors:', e, e2);
                try {
                  const qL3 = query(collection(db, 'lessons'), where('memberIds', 'array-contains', memberId));
                  const lSnap3 = await getDocs(qL3);
                  lSnap3.forEach(d => {
                    const raw = d.data() as any;
                    const ts = raw?.date;
                    const dt: Date | null = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
                    if (!dt) return;
                    if (dt < startDay || dt > endDay) return;
                    const attendedIds: string[] = Array.isArray(raw?.attendedMemberIds) ? raw.attendedMemberIds : [];
                    if (attendedIds.includes(memberId)) attended += 1;
                  });
                } catch (e3) {
                  console.warn('[MemberDashboard] Legacy lessons query by memberIds also failed. Treating as 0 attended.', e3);
                }
              }
            }
            setRemainingLessons(Math.max(0, total - attended));
          } else {
            setRemainingLessons(null);
          }
        } else {
          setRemainingLessons(null);
        }

        // Upcoming lessons (today onward)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        let upcomingList: LessonRow[] = [];
        try {
          console.debug('[MemberDashboard] Query upcoming lessons (UID + range)');
          const qU = query(
            collection(db, 'lessons'),
            where('memberUids', 'array-contains', currentUser.uid),
            where('date', '>=', Timestamp.fromDate(todayStart)),
            orderBy('date', 'asc')
          );
          const uSnap = await getDocs(qU);
          upcomingList = uSnap.docs.map(d => {
            const raw = d.data() as any;
            const ts = raw?.date;
            const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
            return dt ? { id: d.id, date: dt } : null;
          }).filter((x): x is LessonRow => Boolean(x));
        } catch (e) {
          // Fallbacks: UID without range, then ID
          try {
            console.debug('[MemberDashboard] Fallback upcoming lessons (UID only)');
            const qU2 = query(collection(db, 'lessons'), where('memberUids', 'array-contains', currentUser.uid));
            const uSnap2 = await getDocs(qU2);
            upcomingList = uSnap2.docs.map(d => {
              const raw = d.data() as any;
              const ts = raw?.date;
              const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
              return dt ? { id: d.id, date: dt } : null;
            }).filter((x): x is LessonRow => Boolean(x)).filter(x => x.date >= todayStart).sort((a, b) => a.date.getTime() - b.date.getTime());
          } catch (e2) {
            console.warn('[MemberDashboard] Upcoming lessons UID queries failed, trying legacy memberIds. Errors:', e, e2);
            try {
              const qU3 = query(collection(db, 'lessons'), where('memberIds', 'array-contains', memberId));
              const uSnap3 = await getDocs(qU3);
              upcomingList = uSnap3.docs.map(d => {
                const raw = d.data() as any;
                const ts = raw?.date;
                const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
                return dt ? { id: d.id, date: dt } : null;
              }).filter((x): x is LessonRow => Boolean(x)).filter(x => x.date >= todayStart).sort((a, b) => a.date.getTime() - b.date.getTime());
            } catch (e3) {
              console.warn('[MemberDashboard] Legacy upcoming lessons query by memberIds also failed. Proceeding with empty list.', e3);
              upcomingList = [];
            }
          }
        }
        setUpcoming(upcomingList.slice(0, 20));
      } catch (e) {
        console.error('Üye paneli yüklenemedi:', e);
        setError('Bilgiler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [memberId, currentUser]);

  const handleLogout = async () => {
    await auth.signOut();
    window.location.href = '/portal';
  };

  if (loading) return <div className="p-4">Yükleniyor...</div>;
  if (!memberId || !currentUser) return <div className="p-4">Giriş gerekli.</div>;

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-card p-3 sm:p-4 flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">Merhaba{fullName ? `, ${fullName}` : ''}</h2>
          <p className="text-sm text-gray-600">Üye Paneli</p>
        </div>
        <button onClick={handleLogout} className="btn btn-outline">Çıkış Yap</button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-card p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-gray-700">Paket Bilgisi</h3>
        {!activePkg ? (
          <p className="text-sm text-gray-600 mt-2">Aktif paket bulunamadı.</p>
        ) : (
          <div className="mt-2 text-sm text-gray-800">
            <div><span className="text-gray-600">Paket:</span> {activePkg.packageName || 'Paket'}{activePkg.packageId ? '' : ''}</div>
            <div><span className="text-gray-600">Tarih:</span> {formatDateRange(activePkg.start || null, activePkg.end || null)}</div>
            <div><span className="text-gray-600">Kalan Ders:</span> {typeof remainingLessons === 'number' ? remainingLessons : '—'}</div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-card p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-gray-700">Yaklaşan Randevular</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">Yaklaşan randevunuz bulunmuyor.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {upcoming.map(u => (
              <li key={u.id} className="py-2 text-sm text-gray-800">{formatLessonUTC(u.date)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MemberDashboard;
