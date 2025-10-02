// src/pages/AdminDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { FiUsers, FiPackage, FiCalendar, FiDollarSign, FiTrendingUp, FiClock } from 'react-icons/fi';
import { db } from '../firebaseConfig';
import { useFirestoreCollection } from '../hooks/useFirestore';
import MetricCard from '../theme/components/MetricCard';
import Card from '../theme/components/Card';
import Button from '../theme/components/Button';
import Tag from '../theme/components/Tag';

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

  const activeMemberRatio = useMemo(() => {
    if (!stats.totalMembers) return 0;
    return Math.round((stats.activeMembers / stats.totalMembers) * 100);
  }, [stats.activeMembers, stats.totalMembers]);

  const quickLinks = useMemo(
    () => [
      { to: '/members', icon: <FiUsers aria-hidden />, title: 'Üye Yönetimi', description: 'Üye listesi ve detayları' },
      { to: '/calendar', icon: <FiCalendar aria-hidden />, title: 'Takvim', description: 'Ders planlarını görüntüle' },
      { to: '/packages', icon: <FiPackage aria-hidden />, title: 'Paketler', description: 'Paket oluştur ve ata' },
      { to: '/reports', icon: <FiTrendingUp aria-hidden />, title: 'Raporlar', description: 'Performans ve gelir analizi' },
    ],
    [],
  );

  const navigate = useNavigate();

  return (
    <div className="ui-stack" style={{ padding: 'var(--space-lg)', gap: 'var(--space-lg)' }}>
      <Card tone="highlight" padding="lg" header={
        <div className="ui-stack ui-stack--row ui-stack--between" style={{ gap: 'var(--space-md)', alignItems: 'center' }}>
          <div className="ui-stack" style={{ gap: '0.35rem' }}>
            <h1 className="ui-heading ui-heading--lg">Yönetim Paneli</h1>
            <p className="ui-text">Genel performans, güncel dersler ve kritik metriklerin pastel bir görünümü.</p>
          </div>
          <Tag tone="success">Gerçek zamanlı veriler senkron</Tag>
        </div>
      }>
        <div className="ui-grid ui-grid--columns-4">
          <MetricCard
            title="Toplam Üye"
            value={stats.totalMembers}
            icon={<FiUsers />}
            subtitle="Sistemde kayıtlı üye"
            tone="primary"
            loading={stats.loading}
            deltaLabel={`Aktif: ${stats.activeMembers}`}
          />
          <MetricCard
            title="Aktif Paketler"
            value={stats.activePackages}
            icon={<FiPackage />}
            subtitle="Devam eden paket"
            tone="success"
            loading={stats.loading}
            deltaLabel={`Toplam paket: ${stats.totalPackages}`}
          />
          <MetricCard
            title="Bugünkü Dersler"
            value={stats.todayLessons}
            icon={<FiCalendar />}
            subtitle="Takvimde planlanan ders"
            tone="warning"
            loading={stats.loading}
            deltaLabel="Günün programı"
            deltaTone="warning"
          />
          <MetricCard
            title="Bu Ay Gelir"
            value={`₺${stats.thisMonthRevenue.toLocaleString('tr-TR')}`}
            icon={<FiDollarSign />}
            subtitle="Ödeme toplamı"
            tone="info"
            loading={stats.loading}
            deltaLabel={activeMemberRatio ? `%${activeMemberRatio} aktif üye oranı` : 'Veri bekleniyor'}
            deltaTone={activeMemberRatio >= 60 ? 'success' : activeMemberRatio >= 40 ? 'warning' : 'danger'}
          />
        </div>
      </Card>

      <div className="ui-grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-lg)' }}>
        <Card tone="subtle" padding="lg" header={
          <div className="ui-stack ui-stack--row ui-stack--between" style={{ alignItems: 'center' }}>
            <span className="ui-heading ui-heading--md">Hızlı Erişim</span>
            <Button variant="primary" tone="soft" size="sm" onClick={() => navigate('/calendar')}>
              Ders planını aç
            </Button>
          </div>
        }>
          <div className="ui-grid ui-grid--columns-2">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="ui-quick-action">
                <span className="ui-quick-action__icon">{link.icon}</span>
                <span className="ui-quick-action__title">{link.title}</span>
                <span className="ui-quick-action__desc">{link.description}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card tone="default" padding="lg">
          <div className="ui-stack" style={{ gap: 'var(--space-md)' }}>
            <div className="ui-stack" style={{ gap: '0.25rem' }}>
              <span className="ui-heading ui-heading--md">Son Aktiviteler</span>
              <span className="ui-text">Gerçek zamanlı güncellemeler ve önemli bildirimler.</span>
            </div>
            <div className="ui-stack" style={{ gap: 'var(--space-sm)' }}>
              <div className="ui-card ui-card--subtle" style={{ padding: 'var(--space-sm)' }}>
                <div className="ui-stack ui-stack--row" style={{ alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className="ui-quick-action__icon" style={{ width: 36, height: 36 }}>
                    <FiClock />
                  </span>
                  <div className="ui-stack" style={{ gap: '0.15rem' }}>
                    <span className="ui-heading ui-heading--sm">Sistem hazır</span>
                    <span className="ui-text ui-text--muted">Real-time güncellemeler aktif</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
