// src/pages/MemberDashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import { auth, db } from '../firebaseConfig';
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp, where, limit } from 'firebase/firestore';
import { getTypedData, getTypedDataWithId } from '../utils/firestoreHelpers';
import { Button } from '../newUI/primitives';
import PageTransition from '../components/PageTransition';
import { FiUser, FiPackage, FiCalendar, FiClock, FiLogOut, FiCheckCircle } from 'react-icons/fi';

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
  start?: Date | null;
  end?: Date | null;
}

interface LessonRow {
  id: string;
  date: Date;
}



const MemberDashboard: React.FC = () => {
  const { memberId, currentUser } = useAuth();
  const [member, setMember] = useState<MemberDoc | null>(null);
  const [activePkg, setActivePkg] = useState<AssignedPackageRow | null>(null);
  const [remainingLessons, setRemainingLessons] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<LessonRow[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fullName = useMemo(() => {
    if (!member) return '';
    return `${member.name || ''} ${member.surname || ''}`.trim();
  }, [member]);





  useEffect(() => {
    const fetchData = async () => {
      if (!memberId || !currentUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const [memberSnap, packagesSnap] = await Promise.all([
          getDoc(doc(db, 'members', memberId)),
          getDocs(query(collection(db, 'assigned_packages'), where('memberUid', '==', currentUser.uid)))
        ]);

        if (memberSnap.exists()) {
          setMember(getTypedDataWithId<MemberDoc>(memberSnap));
        }

        const now = new Date();
        const rows: AssignedPackageRow[] = packagesSnap.docs.map(d => getTypedDataWithId<AssignedPackageRow>(d));
        const withDates = rows.map(r => ({
          ...r,
          start: r.startDate && typeof r.startDate.toDate === 'function' ? r.startDate.toDate() as Date : null,
          end: r.endDate && typeof r.endDate.toDate === 'function' ? r.endDate.toDate() as Date : null,
        }));

        let target: AssignedPackageRow | null = withDates.find(r => r.start && r.end && r.start <= now && now <= (r.end as Date)) || null;
        if (!target) {
          let latestEndMs = -1;
          withDates.forEach(r => {
            const ms = r.end ? r.end.getTime() : -1;
            if (ms > latestEndMs) { latestEndMs = ms; target = r; }
          });
        }
        setActivePkg(target || null);

        const promises = [];

        if (target && target.start) {
          const total = Number(target.totalLessonCount || 0);
          if (Number.isFinite(total) && total > 0) {
            const startDay = new Date(target.start.getFullYear(), target.start.getMonth(), target.start.getDate(), 0, 0, 0, 0);
            const endDay = target.end ? new Date(target.end.getFullYear(), target.end.getMonth(), target.end.getDate(), 23, 59, 59, 999) : now;

            const qL = query(
              collection(db, 'lessons'),
              where('memberUids', 'array-contains', currentUser.uid),
              where('date', '>=', Timestamp.fromDate(startDay)),
              where('date', '<=', Timestamp.fromDate(endDay))
            );

            promises.push(
              getDocs(qL).then(lSnap => {
                let attended = 0;
                lSnap.forEach(d => {
                  const raw = getTypedData<{ attendedMemberUids?: string[] }>(d);
                  const attendedUids = Array.isArray(raw.attendedMemberUids) ? raw.attendedMemberUids : [];
                  if (attendedUids.includes(currentUser.uid)) attended += 1;
                });
                setRemainingLessons(Math.max(0, total - attended));
              })
            );
          } else {
            setRemainingLessons(null);
          }
        } else {
          setRemainingLessons(null);
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const qU = query(
          collection(db, 'lessons'),
          where('memberUids', 'array-contains', currentUser.uid),
          where('date', '>=', Timestamp.fromDate(todayStart)),
          orderBy('date', 'asc'),
          limit(20)
        );

        promises.push(
          getDocs(qU).then(uSnap => {
            const upcomingList = uSnap.docs.map(d => {
              const raw = getTypedData<{ date?: Timestamp }>(d);
              const ts = raw.date;
              const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
              return dt ? { id: d.id, date: dt } : null;
            }).filter((x): x is LessonRow => Boolean(x));
            setUpcoming(upcomingList);
          })
        );

        // Attendance history: last 10 lessons the member attended
        const todayForHistory = new Date();
        const qH = query(
          collection(db, 'lessons'),
          where('attendedMemberIds', 'array-contains', memberId),
          where('date', '<', Timestamp.fromDate(todayForHistory)),
          orderBy('date', 'desc'),
          limit(10)
        );
        promises.push(
          getDocs(qH).then(hSnap => {
            const historyList = hSnap.docs.map(d => {
              const raw = getTypedData<{ date?: Timestamp }>(d);
              const ts = raw.date;
              const dt = ts && typeof ts.toDate === 'function' ? ts.toDate() as Date : null;
              return dt ? { id: d.id, date: dt } : null;
            }).filter((x): x is LessonRow => Boolean(x));
            setAttendanceHistory(historyList);
          })
        );

        await Promise.all(promises);

      } catch (e) {
        console.error('Üye paneli yüklenemedi:', e);
        setError('Bilgiler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [memberId, currentUser]);

  const handleLogout = async () => {
    await auth.signOut();
    window.location.href = '/portal';
  };

  if (loading) return <div className="p-4 flex justify-center"><div className="spinner"></div></div>;
  if (!memberId || !currentUser) return <div className="p-4">Giriş gerekli.</div>;

  return (
    <PageTransition className="space-y-6 p-4 max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <FiUser size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Merhaba,</h2>
            <p className="text-base text-gray-600 font-medium">{fullName}</p>
          </div>
        </div>
        <Button onClick={handleLogout} variant="neutral" tone="ghost" size="sm" icon={<FiLogOut />}>Çıkış</Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-2xl p-4 text-sm border border-red-100 shadow-sm">
          {error}
        </div>
      )}

      {/* Package Card */}
      <div className="card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <FiPackage size={100} />
        </div>
        <div className="flex items-center gap-2 mb-4">
          <FiPackage className="text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">Paket Durumu</h3>
        </div>

        {!activePkg ? (
          <p className="text-gray-500">Aktif paket bulunamadı.</p>
        ) : (
          <div className="space-y-4 relative z-10">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Aktif Paket</p>
              <p className="text-xl font-bold text-gray-900">{activePkg.packageName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 p-3 rounded-xl backdrop-blur-sm">
                <p className="text-xs text-gray-500 mb-1">Kalan Ders</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {typeof remainingLessons === 'number' ? remainingLessons : '—'}
                </p>
              </div>
              <div className="bg-white/50 p-3 rounded-xl backdrop-blur-sm">
                <p className="text-xs text-gray-500 mb-1">Bitiş Tarihi</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">
                  {activePkg.end ? activePkg.end.toLocaleDateString('tr-TR') : '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Lessons */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <FiCalendar className="text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">Yaklaşan Dersler</h3>
        </div>

        {upcoming.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            <p>Planlanmış dersiniz bulunmuyor.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(u => (
              <div key={u.id} className="card flex items-center gap-4 p-4 hover:scale-[1.02] transition-transform cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 shrink-0">
                  <span className="text-xs font-bold uppercase">{u.date.toLocaleDateString('tr-TR', { month: 'short' })}</span>
                  <span className="text-lg font-bold leading-none">{u.date.getDate()}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-800">{u.date.toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <FiClock size={14} />
                    <span>{u.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Attendance History */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <FiCheckCircle className="text-green-600" />
          <h3 className="text-lg font-bold text-gray-800">Katılım Geçmişi</h3>
        </div>

        {attendanceHistory.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            <p>Katılım kaydı bulunamadı.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attendanceHistory.map(u => (
              <div key={u.id} className="card flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex flex-col items-center justify-center text-green-600 shrink-0">
                  <span className="text-xs font-bold uppercase">{u.date.toLocaleDateString('tr-TR', { month: 'short' })}</span>
                  <span className="text-lg font-bold leading-none">{u.date.getDate()}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-800">{u.date.toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <FiClock size={14} />
                    <span>{u.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default MemberDashboard;
