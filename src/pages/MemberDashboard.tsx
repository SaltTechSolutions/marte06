// src/pages/MemberDashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import { auth, db } from '../firebaseConfig';
import { arrayRemove, collection, doc, getDoc, getDocs, limit, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getTypedData, getTypedDataWithId } from '../utils/firestoreHelpers';
import { Button, Card, ThemeToggle } from '../design-system/components';
import PageTransition from '../components/PageTransition';
import { FiUser, FiPackage, FiCalendar, FiClock, FiLogOut, FiCheckCircle, FiCreditCard, FiEdit2, FiXCircle } from 'react-icons/fi';

interface MemberDoc {
  id: string;
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
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

interface PaymentRow {
  id: string;
  amount?: number;
  date: Date | null;
  notes?: string;
}



const MemberDashboard: React.FC = () => {
  const { memberId, currentUser } = useAuth();
  const [member, setMember] = useState<MemberDoc | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', surname: '', phone: '' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [activePkg, setActivePkg] = useState<AssignedPackageRow | null>(null);
  const [remainingLessons, setRemainingLessons] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [upcoming, setUpcoming] = useState<LessonRow[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingLessonId, setUpdatingLessonId] = useState<string | null>(null);
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
        const [memberSnap, packagesSnap, paymentsSnap] = await Promise.all([
          getDoc(doc(db, 'members', memberId)),
          getDocs(query(collection(db, 'assigned_packages'), where('memberId', '==', memberId))),
          getDocs(query(collection(db, 'payments'), where('memberId', '==', memberId), orderBy('date', 'desc'), limit(20)))
        ]);

        if (memberSnap.exists()) {
          const memberData = getTypedDataWithId<MemberDoc>(memberSnap);
          setMember(memberData);
          setProfileForm({
            name: memberData.name || '',
            surname: memberData.surname || '',
            phone: memberData.phone || '',
          });
        }

        setPayments(paymentsSnap.docs.map(d => {
          const raw = getTypedData<{ amount?: number; date?: Timestamp; notes?: string }>(d);
          return {
            id: d.id,
            amount: raw.amount,
            date: raw.date && typeof raw.date.toDate === 'function' ? raw.date.toDate() : null,
            notes: raw.notes,
          };
        }));

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
          where('attendedMemberUids', 'array-contains', currentUser.uid),
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
    window.location.href = '/login';
  };

  const handleSaveProfile = async () => {
    if (!memberId || !member) return;
    setSavingProfile(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'members', memberId), {
        name: profileForm.name.trim(),
        surname: profileForm.surname.trim(),
        phone: profileForm.phone.trim(),
      });
      setMember({ ...member, ...profileForm });
      setEditingProfile(false);
    } catch (e) {
      console.error('Profil güncellenemedi:', e);
      setError('Kişisel bilgiler güncellenirken bir hata oluştu.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelFutureLesson = async (lesson: LessonRow) => {
    if (!memberId || !currentUser || lesson.date <= new Date()) return;
    setUpdatingLessonId(lesson.id);
    setError(null);
    try {
      await updateDoc(doc(db, 'lessons', lesson.id), {
        memberIds: arrayRemove(memberId),
        memberUids: arrayRemove(currentUser.uid),
        attendedMemberIds: arrayRemove(memberId),
        attendedMemberUids: arrayRemove(currentUser.uid),
        absentMemberIds: arrayRemove(memberId),
        absentMemberUids: arrayRemove(currentUser.uid),
      });
      setUpcoming(prev => prev.filter(item => item.id !== lesson.id));
    } catch (e) {
      console.error('Randevu iptal edilemedi:', e);
      setError('Randevu güncellenirken bir hata oluştu.');
    } finally {
      setUpdatingLessonId(null);
    }
  };

  if (loading) return <div className="p-4 flex justify-center"><div className="spinner"></div></div>;
  if (!memberId || !currentUser) return <div className="p-4">Giriş gerekli.</div>;

  return (
    <PageTransition className="space-y-6 p-4 max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <FiUser size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Merhaba,</h2>
            <p className="text-base text-gray-600 dark:text-gray-400 font-medium">{fullName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={handleLogout} variant="ghost" size="sm" leftIcon={<FiLogOut />}>Çıkış</Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-2xl p-4 text-sm border border-red-100 dark:border-red-950/30 shadow-sm">
          {error}
        </div>
      )}

      {/* Package Card */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FiUser className="text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Kişisel Bilgiler</h3>
          </div>
          <Button onClick={() => setEditingProfile(v => !v)} variant="ghost" size="sm" leftIcon={<FiEdit2 />}>
            {editingProfile ? 'Vazgeç' : 'Düzenle'}
          </Button>
        </div>

        {editingProfile ? (
          <div className="space-y-3">
            <input className="input bg-white dark:bg-black/30 border border-gray-200 dark:border-gray-800 rounded-lg p-2 w-full text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Ad" />
            <input className="input bg-white dark:bg-black/30 border border-gray-200 dark:border-gray-800 rounded-lg p-2 w-full text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500" value={profileForm.surname} onChange={(e) => setProfileForm({ ...profileForm, surname: e.target.value })} placeholder="Soyad" />
            <input className="input bg-white dark:bg-black/30 border border-gray-200 dark:border-gray-800 rounded-lg p-2 w-full text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="Telefon" />
            <Button onClick={handleSaveProfile} loading={savingProfile} fullWidth variant="primary">Kaydet</Button>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p><strong>Ad Soyad:</strong> {fullName || '-'}</p>
            <p><strong>E-posta:</strong> {member?.email || currentUser.email || '-'}</p>
            <p><strong>Telefon:</strong> {member?.phone || '-'}</p>
          </div>
        )}
      </Card>

      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <FiPackage size={100} />
        </div>
        <div className="flex items-center gap-2 mb-4">
          <FiPackage className="text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Paket Durumu</h3>
        </div>

        {!activePkg ? (
          <p className="text-gray-500 dark:text-gray-400">Aktif paket bulunamadı.</p>
        ) : (
          <div className="space-y-4 relative z-10">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Aktif Paket</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{activePkg.packageName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-black/30 p-3 rounded-xl backdrop-blur-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kalan Ders</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {typeof remainingLessons === 'number' ? remainingLessons : '—'}
                </p>
              </div>
              <div className="bg-white/50 dark:bg-black/30 p-3 rounded-xl backdrop-blur-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bitiş Tarihi</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                  {activePkg.end ? activePkg.end.toLocaleDateString('tr-TR') : '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Upcoming Lessons */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <FiCalendar className="text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Yaklaşan Dersler</h3>
        </div>

        {upcoming.length === 0 ? (
          <Card className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-black/30">
            <p>Planlanmış dersiniz bulunmuyor.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map(u => (
              <Card interactive key={u.id} className="flex items-center gap-4 hover:scale-[1.02] transition-transform cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <span className="text-xs font-bold uppercase">{u.date.toLocaleDateString('tr-TR', { month: 'short' })}</span>
                  <span className="text-lg font-bold leading-none">{u.date.getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 dark:text-gray-200">{u.date.toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <FiClock size={14} />
                    <span>{u.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <Button
                  onClick={() => handleCancelFutureLesson(u)}
                  loading={updatingLessonId === u.id}
                  variant="ghost"
                  size="sm"
                  leftIcon={<FiXCircle />}
                >
                  İptal
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Payments */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <FiCreditCard className="text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Ödemeler</h3>
        </div>

        {payments.length === 0 ? (
          <Card className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-black/30">
            <p>Ödeme kaydı bulunamadı.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map(payment => (
              <Card key={payment.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-200">
                    {typeof payment.amount === 'number' ? payment.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : '-'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{payment.date ? payment.date.toLocaleDateString('tr-TR') : '-'}</p>
                </div>
                {payment.notes && <p className="text-sm text-gray-500 dark:text-gray-400 text-right">{payment.notes}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Attendance History */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <FiCheckCircle className="text-green-600" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Katılım Geçmişi</h3>
        </div>

        {attendanceHistory.length === 0 ? (
          <Card className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-black/30">
            <p>Katılım kaydı bulunamadı.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {attendanceHistory.map(u => (
              <Card key={u.id} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-950/30 flex flex-col items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                  <span className="text-xs font-bold uppercase">{u.date.toLocaleDateString('tr-TR', { month: 'short' })}</span>
                  <span className="text-lg font-bold leading-none">{u.date.getDate()}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-200">{u.date.toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <FiClock size={14} />
                    <span>{u.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default MemberDashboard;
