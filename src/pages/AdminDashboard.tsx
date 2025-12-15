// src/pages/AdminDashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { FiUsers, FiPackage, FiCalendar, FiDollarSign, FiTrendingUp, FiClock, FiActivity, FiLogOut, FiShield, FiUser } from 'react-icons/fi';
import { db } from '../firebaseConfig';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { useAuth } from '../utils/AuthContext';
import { Button } from '../newUI/primitives';
import PageTransition from '../components/PageTransition';

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

  const { data: members, loading: membersLoading } = useFirestoreCollection('members', [], { realtime: true });
  const { data: packages, loading: packagesLoading } = useFirestoreCollection('packages', [], { realtime: true });
  const { currentUser, userRole, logout } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const activeMembersCount = members.filter((m: any) => m.isActive !== false).length;

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

        const now = Timestamp.now();
        const assignedPackagesSnapshot = await getDocs(query(collection(db, 'assigned_packages')));

        let activePackagesCount = 0;
        assignedPackagesSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data.endDate || data.endDate.toMillis() > now.toMillis()) {
            activePackagesCount++;
          }
        });

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

  const quickLinks = [
    { to: '/members', icon: <FiUsers />, title: 'Üyeler', color: 'bg-blue-100 text-blue-600' },
    { to: '/calendar', icon: <FiCalendar />, title: 'Takvim', color: 'bg-purple-100 text-purple-600' },
    { to: '/packages', icon: <FiPackage />, title: 'Paketler', color: 'bg-orange-100 text-orange-600' },
    { to: '/reports', icon: <FiTrendingUp />, title: 'Raporlar', color: 'bg-green-100 text-green-600' },
  ];

  const StatCard = ({ title, value, icon, subValue, colorClass }: any) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800">{stats.loading ? '-' : value}</h3>
        {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colorClass}`}>
        {icon}
      </div>
    </div>
  );

  return (
    <PageTransition className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yönetim Paneli</h1>
          <p className="text-gray-500 text-sm">Genel duruma hızlı bir bakış.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Kullanıcı Bilgisi */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${userRole === 'admin'
                ? 'bg-indigo-100 text-indigo-600'
                : 'bg-gray-100 text-gray-600'
              }`}>
              {userRole === 'admin' ? <FiShield size={16} /> : <FiUser size={16} />}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-gray-900 truncate max-w-[150px]">
                {currentUser?.email || 'Bilinmiyor'}
              </p>
              <p className={`text-xs font-semibold ${userRole === 'admin' ? 'text-indigo-600' : 'text-gray-500'
                }`}>
                {userRole === 'admin' ? 'Admin' : userRole === 'member' ? 'Üye' : 'Misafir'}
              </p>
            </div>
          </div>
          {/* Rol Badge - Mobilde görünür */}
          <div className={`sm:hidden flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${userRole === 'admin'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-700'
            }`}>
            {userRole === 'admin' ? <FiShield size={12} /> : <FiUser size={12} />}
            {userRole === 'admin' ? 'Admin' : 'Üye'}
          </div>
          {/* Çıkış Butonu */}
          <button
            onClick={logout}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Çıkış Yap"
          >
            <FiLogOut size={18} />
          </button>
          {/* Sistem Durumu */}
          <div className="hidden md:flex items-center gap-2 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Aktif
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Toplam Üye"
          value={stats.totalMembers}
          subValue={`${stats.activeMembers} Aktif`}
          icon={<FiUsers />}
          colorClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="Aktif Paketler"
          value={stats.activePackages}
          subValue={`${stats.totalPackages} Toplam`}
          icon={<FiPackage />}
          colorClass="bg-pink-50 text-pink-600"
        />
        <StatCard
          title="Bugünkü Dersler"
          value={stats.todayLessons}
          subValue="Planlanan"
          icon={<FiCalendar />}
          colorClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Bu Ay Gelir"
          value={`₺${stats.thisMonthRevenue.toLocaleString('tr-TR')}`}
          subValue="Tahmini"
          icon={<FiDollarSign />}
          colorClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Access - Takes up 2 columns on large screens, full on mobile */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FiActivity className="text-indigo-500" /> Hızlı Erişim
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 transition-transform group-hover:scale-110 ${link.color}`}>
                  {link.icon}
                </div>
                <span className="font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">{link.title}</span>
              </Link>
            ))}
          </div>

          {/* Recent Activity Placeholder - Can be expanded later */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Son Aktiviteler</h3>
              <Button variant="neutral" tone="ghost" size="sm">Tümünü Gör</Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                  <FiClock size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Sistem Başlatıldı</p>
                  <p className="text-xs text-gray-500">Az önce</p>
                </div>
              </div>
              {/* More items can be added here */}
            </div>
          </div>
        </div>

        {/* Side Panel / Notifications - Takes up 1 column on large screens */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FiClock className="text-orange-500" /> Bildirimler
          </h2>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Mobil Uygulama</h3>
              <p className="text-indigo-100 text-sm mb-4">Yeni mobil uyumlu arayüz yayında! Deneyimlerinizi paylaşın.</p>
              <Button variant="neutral" tone="solid" size="sm" className="bg-white text-indigo-600 border-none hover:bg-gray-100">
                Detaylar
              </Button>
            </div>
            <div className="absolute -bottom-4 -right-4 opacity-20 text-9xl">
              <FiTrendingUp />
            </div>
          </div>
        </div>

      </div>
    </PageTransition>
  );
};

export default AdminDashboard;
