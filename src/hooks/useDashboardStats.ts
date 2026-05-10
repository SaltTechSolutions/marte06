// src/hooks/useDashboardStats.ts
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  date: Date;
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalPackages: number;
  activePackages: number;
  todayLessons: number;
  thisMonthRevenue: number;
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    totalPackages: 0,
    activePackages: 0,
    todayLessons: 0,
    thisMonthRevenue: 0,
    notifications: [],
    loading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    setStats(prev => ({ ...prev, loading: true, error: null }));
    try {
      // 1. Total Members & Active Members (using getCountFromServer if possible, but we need both so getDocs is ok, or two count queries)
      // Since member count might be small, getDocs is fine, but getCountFromServer is cheaper.
      // Actually, let's use getDocs for members to be safe with the `!== false` logic used before.
      const membersSnap = await getDocs(collection(db, 'members'));
      const totalMembersCount = membersSnap.size;
      const activeMembersCount = membersSnap.docs.filter(doc => doc.data().isActive !== false).length;

      // 2. Packages Count
      const packagesSnap = await getCountFromServer(collection(db, 'packages'));
      const totalPackages = packagesSnap.data().count;

      // 3. Today's Lessons
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const lessonsQuery = query(
        collection(db, 'lessons'),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<', Timestamp.fromDate(tomorrow))
      );
      const lessonsSnapshot = await getCountFromServer(lessonsQuery);
      const todayLessons = lessonsSnapshot.data().count;

      const notifs: NotificationItem[] = [];
      const memberMap = new Map<string, string>();
      membersSnap.docs.forEach(d => {
        const data = d.data();
        memberMap.set(d.id, `${data.name} ${data.surname}`);
      });

      // 4. Active Assigned Packages & Expiring notifications
      const now = Timestamp.now();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const activePackagesQuery = query(
        collection(db, 'assigned_packages'),
        where('endDate', '>', now)
      );
      const [activePackagesCountSnap, expiringPackagesSnapshot] = await Promise.all([
        getCountFromServer(activePackagesQuery),
        getDocs(query(
          collection(db, 'assigned_packages'),
          where('endDate', '>', now),
          where('endDate', '<=', Timestamp.fromDate(sevenDaysFromNow))
        ))
      ]);
      const activePackagesCount = activePackagesCountSnap.data().count;

      expiringPackagesSnapshot.forEach(doc => {
        const data = doc.data();
        const memberName = memberMap.get(data.memberId) || 'Bilinmeyen Üye';
        const endD = data.endDate?.toDate?.();
        if (endD) {
          const diffTime = Math.abs(endD.getTime() - new Date().getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          notifs.push({
              id: doc.id,
              title: 'Paket Süresi Bitiyor',
              message: `${memberName} üyesinin paket süresinin bitmesine ${diffDays} gün kaldı.`,
              type: diffDays <= 2 ? 'danger' : 'warning',
              date: new Date()
          });
        }
      });

      // Add Today's Lessons to Notifications if any
      if (todayLessons > 0) {
          notifs.push({
              id: 'today-lessons',
              title: 'Bugünkü Dersler',
              message: `Bugün planlanmış toplam ${todayLessons} dersiniz var.`,
              type: 'info',
              date: new Date()
          });
      }

      notifs.sort((a,b) => b.date.getTime() - a.date.getTime());

      // 5. This Month Revenue
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('date', '>=', Timestamp.fromDate(firstDayOfMonth))
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      let monthRevenue = 0;
      paymentsSnapshot.forEach(doc => {
        monthRevenue += doc.data().amount || 0;
      });

      setStats({
        totalMembers: totalMembersCount,
        activeMembers: activeMembersCount,
        totalPackages,
        activePackages: activePackagesCount,
        todayLessons,
        thisMonthRevenue: monthRevenue,
        notifications: notifs,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error fetching dashboard stats:', error);
      setStats(prev => ({ ...prev, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Optional: Refresh every 5 minutes instead of realtime listener to save reads
    const intervalId = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchStats]);

  return { stats, refetch: fetchStats };
}
