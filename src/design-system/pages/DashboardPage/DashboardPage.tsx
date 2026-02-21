// src/design-system/pages/DashboardPage/DashboardPage.tsx
// Modern, mobil-öncelikli Admin Dashboard

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, getCountFromServer, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../../utils/AuthContext';
import {
    Card,
    Button,
    Avatar,
    Badge,
    AppShell,
    Header,
    BottomNav
} from '../../components';
import {
    FiUsers,
    FiPackage,
    FiCalendar,
    FiDollarSign,
    FiTrendingUp,
    FiPlus,
    FiChevronRight,
    FiLogOut,
    FiShield,
    FiUser,
    FiAlertTriangle
} from 'react-icons/fi';

interface DashboardStats {
    totalMembers: number;
    activeMembers: number;
    totalPackages: number;
    activePackages: number;
    todayLessons: number;
    thisMonthRevenue: number;
    loading: boolean;
}

export const DashboardPage: React.FC = () => {
    const { currentUser, userRole, logout } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalMembers: 0,
        activeMembers: 0,
        totalPackages: 0,
        activePackages: 0,
        todayLessons: 0,
        thisMonthRevenue: 0,
        loading: true
    });

    const [recentMembers, setRecentMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(true);
    const [expiringPackages, setExpiringPackages] = useState<{ memberName: string; packageName: string; daysLeft: number }[]>([]);

    useEffect(() => {
        const fetchAsyncStats = async () => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Toplam sayılar için getCountFromServer kullanarak okuma maliyetlerini devasa oranda düşürüyoruz
                const membersColl = collection(db, 'members');
                const packagesColl = collection(db, 'packages');

                const [totalMembersSnap, totalPackagesSnap] = await Promise.all([
                    getCountFromServer(membersColl),
                    getCountFromServer(packagesColl)
                ]);

                // Today's lessons
                const lessonsQuery = query(
                    collection(db, 'lessons'),
                    where('date', '>=', Timestamp.fromDate(today)),
                    where('date', '<', Timestamp.fromDate(tomorrow))
                );

                // This month's revenue
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const paymentsQuery = query(
                    collection(db, 'payments'),
                    where('date', '>=', Timestamp.fromDate(firstDayOfMonth))
                );

                const [lessonsSnapshot, paymentsSnapshot] = await Promise.all([
                    getDocs(lessonsQuery),
                    getDocs(paymentsQuery)
                ]);

                let monthRevenue = 0;
                paymentsSnapshot.forEach(doc => {
                    monthRevenue += doc.data().amount || 0;
                });

                // Active packages (Assigned) - hala tam tablo taramak gerekebilir, 
                // ancak bunu where şartı ile optimize etmeyi deneyebiliriz.
                // Firebase where() kullanarak "endDate > now" olanları alıyoruz.
                const now = Timestamp.now();
                const assignedPackagesColl = collection(db, 'assigned_packages');
                const activeAssignedQuery = query(assignedPackagesColl, where('endDate', '>=', now));
                const assignedSnapshot = await getDocs(activeAssignedQuery);
                const assignedCount = assignedSnapshot.size;

                // Son 5 üyeyi getirmek için limit query
                const recentQuery = query(membersColl, orderBy('createdAt', 'desc'), limit(5));
                const recentSnap = await getDocs(recentQuery);
                const recentList = recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setRecentMembers(recentList);
                setMembersLoading(false);

                setStats({
                    totalMembers: totalMembersSnap.data().count,
                    activeMembers: totalMembersSnap.data().count, // Varsayılan olarak toplam üyeye eşit, indeks gerektirmediğinden
                    totalPackages: totalPackagesSnap.data().count,
                    activePackages: assignedCount,
                    todayLessons: lessonsSnapshot.size,
                    thisMonthRevenue: monthRevenue,
                    loading: false
                });

                // Expiring packages calculation for within 7 days
                const sevenDaysLater = new Date(today);
                sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
                const expiring: { memberName: string; packageName: string; daysLeft: number }[] = [];

                assignedSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.endDate) {
                        const endDate: Date = data.endDate.toDate();
                        const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysLeft >= 0 && daysLeft <= 7) {
                            expiring.push({
                                memberName: data.memberName || data.memberId || 'Bilinmeyen Üye',
                                packageName: data.packageName || 'Paket',
                                daysLeft,
                            });
                        }
                    }
                });

                setExpiringPackages(expiring);

            } catch (error) {
                if (import.meta.env.DEV) console.error('Error fetching dashboard stats:', error);
                setStats(prev => ({ ...prev, loading: false }));
                setMembersLoading(false);
            }
        };

        fetchAsyncStats();
    }, []);

    const quickActions = [
        { to: '/members', icon: <FiUsers />, label: 'Üyeler', color: 'primary' },
        { to: '/calendar', icon: <FiCalendar />, label: 'Takvim', color: 'purple' },
        { to: '/packages', icon: <FiPackage />, label: 'Paketler', color: 'orange' },
        { to: '/reports', icon: <FiTrendingUp />, label: 'Raporlar', color: 'green' },
    ];

    return (
        <AppShell
            header={
                <Header
                    title="Marte"
                    rightAction={
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 py-1 px-2 bg-[var(--color-primary-100)] text-[var(--color-primary-700)] rounded-full text-xs font-semibold">
                                {userRole === 'admin' ? <FiShield size={14} /> : <FiUser size={14} />}
                                <span className="hidden sm:inline">
                                    {userRole === 'admin' ? 'Admin' : 'Üye'}
                                </span>
                            </div>
                            <button className="flex items-center justify-center w-9 h-9 rounded-md text-[var(--color-text-secondary)] transition-all duration-200 active:scale-95 hover:bg-red-50 hover:text-red-600 cursor-pointer border-none bg-transparent" onClick={logout} title="Çıkış Yap">
                                <FiLogOut size={18} />
                            </button>
                        </div>
                    }
                />
            }
            bottomNav={<BottomNav />}
        >
            <div className="p-4 pb-[calc(var(--bottom-nav-height)+1.5rem)] max-w-[var(--max-content-width)] mx-auto lg:p-6">
                {/* Welcome */}
                <section className="mb-6">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-[var(--color-text)] m-0 mb-1">
                            Merhaba{currentUser?.email ? `, ${currentUser.email.split('@')[0]}` : ''}! 👋
                        </h1>
                        <p className="text-sm text-[var(--color-text-secondary)] m-0">
                            Bugün {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                </section>

                {/* Stats Grid */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <StatCard
                        label="Toplam Üye"
                        value={stats.loading ? '-' : stats.totalMembers}
                        subValue="kayıtlı"
                        icon={<FiUsers />}
                        color="primary"
                    />
                    <StatCard
                        label="Aktif Paket"
                        value={stats.loading ? '-' : stats.activePackages}
                        subValue={`${stats.totalPackages} toplam`}
                        icon={<FiPackage />}
                        color="pink"
                    />
                    <StatCard
                        label="Bugün Ders"
                        value={stats.loading ? '-' : stats.todayLessons}
                        subValue="planlandı"
                        icon={<FiCalendar />}
                        color="orange"
                    />
                    <StatCard
                        label="Bu Ay Gelir"
                        value={stats.loading ? '-' : `₺${stats.thisMonthRevenue.toLocaleString('tr-TR')}`}
                        subValue="kazanıldı"
                        icon={<FiDollarSign />}
                        color="green"
                    />
                </section>

                {/* Quick Actions */}
                <section className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-[var(--color-text)] m-0">Hızlı Erişim</h2>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        {quickActions.map((action) => (
                            <Link key={action.to} to={action.to} className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl no-underline transition-all duration-200 active:scale-95 hover:border-[var(--color-border-strong)] hover:shadow-sm hover:-translate-y-0.5" style={{ '--tw-text-opacity': 1 } as any}>
                                <span className={`w-11 h-11 rounded-lg flex items-center justify-center text-[22px] overflow-hidden ${action.color === 'primary' ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-600)]' :
                                        action.color === 'purple' ? 'bg-[#f3e8ff] text-[#7c3aed]' :
                                            action.color === 'orange' ? 'bg-[var(--color-warning-100)] text-[var(--color-warning-600)]' :
                                                'bg-[var(--color-success-100)] text-[var(--color-success-600)]'
                                    }`}>
                                    {action.icon}
                                </span>
                                <span className="text-xs sm:text-sm font-medium text-[var(--color-text)] truncate w-full text-center">{action.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Recent Members */}
                <section className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-[var(--color-text)] m-0">Son Üyeler</h2>
                        <Link to="/members" className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] no-underline">
                            Tümünü Gör <FiChevronRight size={16} />
                        </Link>
                    </div>
                    <RecentMembers members={recentMembers} loading={membersLoading} />
                </section>

                {/* Expiring Packages Alert */}
                {expiringPackages.length > 0 && (
                    <section className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-[var(--color-text)] m-0 flex items-center gap-2">
                                <FiAlertTriangle style={{ color: 'var(--color-warning, #f59e0b)' }} />
                                Dikkat Gerektiren
                            </h2>
                        </div>
                        <div className="flex flex-col gap-2">
                            {expiringPackages.map((item, idx) => (
                                <Card key={idx} variant="outlined" className="!py-3 !px-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <span className="block text-sm font-semibold text-[var(--color-text)]">{item.memberName}</span>
                                            <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">{item.packageName}</span>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${item.daysLeft <= 2 ? 'text-red-600 bg-red-50' : 'text-yellow-600 bg-yellow-50'}`}>
                                            {item.daysLeft === 0 ? 'Bugün bitiyor' : `${item.daysLeft} gün kaldı`}
                                        </span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {/* Add Member CTA */}
                <section className="mt-6">
                    <Card variant="filled" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 !p-5">
                        <div>
                            <h3 className="text-base font-semibold text-[var(--color-text)] m-0 mb-1">Yeni Üye Ekle</h3>
                            <p className="text-sm text-[var(--color-text-secondary)] m-0">Hızlıca yeni bir üye kaydı oluşturun.</p>
                        </div>
                        <Link to="/members?add=true" className="w-full sm:w-auto">
                            <Button variant="primary" leftIcon={<FiPlus />} className="w-full sm:w-auto active:scale-95 transition-transform duration-200">
                                Ekle
                            </Button>
                        </Link>
                    </Card>
                </section>
            </div>
        </AppShell>
    );
};

// Stat Card Component
interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: React.ReactNode;
    color: 'primary' | 'pink' | 'orange' | 'green';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon, color }) => (
    <Card variant="elevated" className={`flex justify-between items-start !p-4 border-l-4 ${color === 'primary' ? 'border-blue-500' : color === 'pink' ? 'border-pink-500' : color === 'orange' ? 'border-orange-500' : 'border-green-500'}`}>
        <div className="flex flex-col gap-[2px]">
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">{label}</span>
            <span className="text-xl font-bold text-[var(--color-text)]">{value}</span>
            {subValue && <span className="text-xs text-[var(--color-text-muted)]">{subValue}</span>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[20px] shrink-0 ${color === 'primary' ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-600)]' :
                color === 'pink' ? 'bg-pink-100 text-pink-600' :
                    color === 'orange' ? 'bg-orange-100 text-orange-600' :
                        'bg-green-100 text-green-600'
            }`}>
            {icon}
        </div>
    </Card>
);

// Recent Members Component
interface RecentMembersProps {
    members: any[];
    loading: boolean;
}

const RecentMembers: React.FC<RecentMembersProps> = ({ members, loading }) => {
    if (loading) {
        return <div className="p-6 text-center text-[var(--color-text-secondary)]">Yükleniyor...</div>;
    }

    if (!members || members.length === 0) {
        return (
            <Card variant="outlined" className="p-6 text-center text-[var(--color-text-secondary)]">
                <p>Henüz üye yok</p>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {members.map((member) => {
                const fullName = `${member.name || ''} ${member.surname || ''}`.trim();
                const isActive = member.isActive !== false;

                return (
                    <Link key={member.id} to="/members" className="flex items-center gap-3 p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg no-underline transition-all duration-200 active:scale-[0.98] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)]">
                        <Avatar name={fullName} size="sm" />
                        <div className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-[var(--color-text)] truncate">{fullName}</span>
                            <span className="block text-xs text-[var(--color-text-muted)]">{member.phone || member.email || '-'}</span>
                        </div>
                        <Badge variant={isActive ? 'success' : 'default'} size="sm">
                            {isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                    </Link>
                );
            })}
        </div>
    );
};

export default DashboardPage;
