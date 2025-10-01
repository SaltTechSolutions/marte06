// src/pages/AdminDashboard.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import StatCard from '../components/StatCard';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { FiUsers, FiPackage, FiCalendar, FiDollarSign, FiTrendingUp, FiClock } from 'react-icons/fi';
import './AdminDashboard.css';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalPackages: number;
  activePackages: number;
  todayLessons: number;
  thisMonthRevenue: number;
  loading: boolean;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    totalPackages: 0,
    activePackages: 0,
    todayLessons: 0,
    thisMonthRevenue: 0,
    loading: true
  });

  // Real-time members data
  const { data: members, loading: membersLoading } = useFirestoreCollection('members', [], {
    realtime: true
  });

  // Real-time packages data
  const { data: packages, loading: packagesLoading } = useFirestoreCollection('packages', [], {
    realtime: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Active members (isActive = true)
        const activeMembersCount = members.filter((m: any) => m.isActive !== false).length;

        // Today's lessons
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('date', '>=', Timestamp.fromDate(today)),
          where('date', '<', Timestamp.fromDate(tomorrow))
        );
        const lessonsSnapshot = await getDocs(lessonsQuery);

        // Active packages (not expired)
        const now = Timestamp.now();
        const assignedPackagesQuery = query(
          collection(db, 'assigned_packages')
        );
        const assignedPackagesSnapshot = await getDocs(assignedPackagesQuery);
        
        let activePackagesCount = 0;
        assignedPackagesSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data.endDate || data.endDate.toMillis() > now.toMillis()) {
            activePackagesCount++;
          }
        });

        // This month's revenue
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
          totalMembers: members.length,
          activeMembers: activeMembersCount,
          totalPackages: packages.length,
          activePackages: activePackagesCount,
          todayLessons: lessonsSnapshot.size,
          thisMonthRevenue: monthRevenue,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    if (!membersLoading && !packagesLoading) {
      fetchStats();
    }
  }, [members, packages, membersLoading, packagesLoading]);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">Genel bakış ve istatistikler</p>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Toplam Üye"
          value={stats.totalMembers}
          icon={<FiUsers />}
          subtitle={`${stats.activeMembers} aktif üye`}
          variant="primary"
          loading={stats.loading}
        />

        <StatCard
          title="Aktif Paketler"
          value={stats.activePackages}
          icon={<FiPackage />}
          subtitle={`${stats.totalPackages} toplam paket`}
          variant="success"
          loading={stats.loading}
        />

        <StatCard
          title="Bugünkü Dersler"
          value={stats.todayLessons}
          icon={<FiCalendar />}
          subtitle="Planlanan ders sayısı"
          variant="warning"
          loading={stats.loading}
        />

        <StatCard
          title="Bu Ay Gelir"
          value={`₺${stats.thisMonthRevenue.toLocaleString('tr-TR')}`}
          icon={<FiDollarSign />}
          subtitle="Toplam ödeme"
          variant="success"
          loading={stats.loading}
        />
      </div>

      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2>Hızlı Erişim</h2>
          <div className="quick-actions">
            <a href="/members" className="quick-action-card">
              <FiUsers />
              <span>Üye Yönetimi</span>
            </a>
            <a href="/calendar" className="quick-action-card">
              <FiCalendar />
              <span>Takvim</span>
            </a>
            <a href="/packages" className="quick-action-card">
              <FiPackage />
              <span>Paketler</span>
            </a>
            <a href="/reports" className="quick-action-card">
              <FiTrendingUp />
              <span>Raporlar</span>
            </a>
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Son Aktiviteler</h2>
          <div className="activity-list">
            <div className="activity-item">
              <FiClock />
              <div className="activity-content">
                <p className="activity-title">Sistem hazır</p>
                <p className="activity-time">Real-time güncellemeler aktif</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
