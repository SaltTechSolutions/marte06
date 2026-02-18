// src/design-system/pages/DashboardPage/DashboardPage.tsx
// Modern, mobil-öncelikli Admin Dashboard

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
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
import './DashboardPage.css';

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

    // Expiring packages (within 7 days)
    const [expiringPackages, setExpiringPackages] = useState<{ memberName: string; packageName: string; daysLeft: number }[]>([]);

    const statsQueryConstraints = React.useMemo(() => [], []);
    const statsQueryOptions = React.useMemo(() => ({ realtime: true }), []);

    const { data: members, loading: membersLoading } = useFirestoreCollection('members', statsQueryConstraints, statsQueryOptions);
    const { data: packages, loading: packagesLoading } = useFirestoreCollection('packages', statsQueryConstraints, statsQueryOptions);

    // Realtime data calculations
    const activeMembersCount = React.useMemo(() => members.filter((m: any) => m.isActive !== false).length, [members]);

    // fetchStats sadece lesson ve revenue verilerini çeker
    useEffect(() => {
        const fetchAsyncStats = async () => {
            // Sadece loadingler bittiğinde değil, direkt çekebilir
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Today's lessons
                const lessonsQuery = query(
                    collection(db, 'lessons'),
                    where('date', '>=', Timestamp.fromDate(today)),
                    where('date', '<', Timestamp.fromDate(tomorrow))
                );
                const lessonsSnapshot = await getDocs(lessonsQuery);

                // Active packages (Assigned) - bu ayrı bir collection
                const now = Timestamp.now();
                const assignedPackagesSnapshot = await getDocs(collection(db, 'assigned_packages'));
                let assignedCount = 0;
                assignedPackagesSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!data.endDate || data.endDate.toMillis() > now.toMillis()) {
                        assignedCount++;
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

                setStats(prev => ({
                    ...prev,
                    todayLessons: lessonsSnapshot.size,
                    activePackages: assignedCount,
                    thisMonthRevenue: monthRevenue,
                    loading: false
                }));

                // Expiring packages: endDate within 7 days from now
                const sevenDaysLater = new Date(today);
                sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
                const expiring: { memberName: string; packageName: string; daysLeft: number }[] = [];

                assignedPackagesSnapshot.forEach(docSnap => {
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

                // Enrich with member names from the already-fetched members list
                setExpiringPackages(expiring);

            } catch (error) {
                if (import.meta.env.DEV) console.error('Error fetching dashboard stats:', error);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };

        fetchAsyncStats();
    }, []); // Run once on mount

    // Update member/package counts immediately
    useEffect(() => {
        if (!membersLoading && !packagesLoading) {
            setStats(prev => ({
                ...prev,
                totalMembers: members.length,
                totalPackages: packages.length,
                // activeMembersCount'u burada set etmeye gerek yok, UI'da direkt kullanabiliriz ama stats yapısını korumak için:
                activeMembers: activeMembersCount
            }));
        }
    }, [members.length, packages.length, membersLoading, packagesLoading, activeMembersCount]);

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
                        <div className="dashboard-user-info">
                            <div className="dashboard-user-badge">
                                {userRole === 'admin' ? <FiShield size={14} /> : <FiUser size={14} />}
                                <span className="dashboard-user-role">
                                    {userRole === 'admin' ? 'Admin' : 'Üye'}
                                </span>
                            </div>
                            <button className="dashboard-logout" onClick={logout} title="Çıkış Yap">
                                <FiLogOut size={18} />
                            </button>
                        </div>
                    }
                />
            }
            bottomNav={<BottomNav />}
        >
            <div className="dashboard-page">
                {/* Welcome */}
                <section className="dashboard-welcome">
                    <div className="dashboard-welcome-content">
                        <h1 className="dashboard-welcome-title">
                            Merhaba{currentUser?.email ? `, ${currentUser.email.split('@')[0]}` : ''}! 👋
                        </h1>
                        <p className="dashboard-welcome-subtitle">
                            Bugün {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                </section>

                {/* Stats Grid */}
                <section className="dashboard-stats">
                    <StatCard
                        label="Toplam Üye"
                        value={stats.loading ? '-' : stats.totalMembers}
                        subValue={`${stats.activeMembers} aktif`}
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
                <section className="dashboard-section">
                    <h2 className="dashboard-section-title">Hızlı Erişim</h2>
                    <div className="dashboard-quick-actions">
                        {quickActions.map((action) => (
                            <Link key={action.to} to={action.to} className={`quick-action quick-action--${action.color}`}>
                                <span className="quick-action-icon">{action.icon}</span>
                                <span className="quick-action-label">{action.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Recent Members */}
                <section className="dashboard-section">
                    <div className="dashboard-section-header">
                        <h2 className="dashboard-section-title">Son Üyeler</h2>
                        <Link to="/members" className="dashboard-section-link">
                            Tümünü Gör <FiChevronRight size={16} />
                        </Link>
                    </div>
                    <RecentMembers members={[...members].sort((a: any, b: any) => {
                        const aMs = a.createdAt?.toMillis?.() ?? 0;
                        const bMs = b.createdAt?.toMillis?.() ?? 0;
                        return bMs - aMs;
                    }).slice(0, 5)} loading={membersLoading} />
                </section>

                {/* Expiring Packages Alert */}
                {expiringPackages.length > 0 && (
                    <section className="dashboard-section">
                        <div className="dashboard-section-header">
                            <h2 className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FiAlertTriangle style={{ color: 'var(--color-warning, #f59e0b)' }} />
                                Dikkat Gerektiren
                            </h2>
                        </div>
                        <div className="space-y-2">
                            {expiringPackages.map((item, idx) => (
                                <Card key={idx} variant="outlined" className="expiring-alert-card">
                                    <div className="expiring-alert-content">
                                        <div>
                                            <span className="expiring-alert-member">{item.memberName}</span>
                                            <span className="expiring-alert-pkg">{item.packageName}</span>
                                        </div>
                                        <span className={`expiring-alert-days ${item.daysLeft <= 2 ? 'expiring-alert-days--urgent' : ''}`}>
                                            {item.daysLeft === 0 ? 'Bugün bitiyor' : `${item.daysLeft} gün kaldı`}
                                        </span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {/* Add Member CTA */}
                <section className="dashboard-cta">
                    <Card variant="filled" className="dashboard-cta-card">
                        <div className="dashboard-cta-content">
                            <h3>Yeni Üye Ekle</h3>
                            <p>Hızlıca yeni bir üye kaydı oluşturun.</p>
                        </div>
                        <Link to="/members?add=true">
                            <Button variant="primary" leftIcon={<FiPlus />}>
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
    <Card variant="elevated" className={`stat-card stat-card--${color}`}>
        <div className="stat-card-content">
            <span className="stat-card-label">{label}</span>
            <span className="stat-card-value">{value}</span>
            {subValue && <span className="stat-card-sub">{subValue}</span>}
        </div>
        <div className={`stat-card-icon stat-card-icon--${color}`}>
            {icon}
        </div>
    </Card>
);

// Recent Members Component
interface RecentMembersProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members: any[];
    loading: boolean;
}

const RecentMembers: React.FC<RecentMembersProps> = ({ members, loading }) => {
    if (loading) {
        return <div className="recent-members-loading">Yükleniyor...</div>;
    }

    if (!members || members.length === 0) {
        return (
            <Card variant="outlined" className="recent-members-empty">
                <p>Henüz üye yok</p>
            </Card>
        );
    }

    return (
        <div className="recent-members">
            {members.map((member) => {
                const fullName = `${member.name || ''} ${member.surname || ''}`.trim();
                const isActive = member.isActive !== false;

                return (
                    <Link key={member.id} to="/members" className="recent-member-item">
                        <Avatar name={fullName} size="sm" />
                        <div className="recent-member-info">
                            <span className="recent-member-name">{fullName}</span>
                            <span className="recent-member-phone">{member.phone || member.email || '-'}</span>
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
