// src/design-system/pages/ReportsPage/ReportsPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { AppShell, Header, BottomNav, Card, Select, Input, Button } from '../../components';
import { FiBarChart2, FiCalendar, FiUser, FiDollarSign, FiDownload, FiUserX, FiPieChart } from 'react-icons/fi';
import './ReportsPage.css';

interface Member {
    id: string;
    name: string;
    surname: string;
}

interface MonthlyData {
    label: string;
    value: number;
}

export const ReportsPage: React.FC = () => {
    // --- State: General Report ---
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyData[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);

    // --- State: Member Report ---
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [attendanceData, setAttendanceData] = useState<{ date: Date; timeSlot: string }[]>([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);

    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
    const [filterType, setFilterType] = useState<'month' | 'range'>('month');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // --- State: Advanced Reports ---
    const [revenueTrend, setRevenueTrend] = useState<MonthlyData[]>([]);
    const [loadingRevenue, setLoadingRevenue] = useState(false);

    const [absenceReport, setAbsenceReport] = useState<{ name: string; absences: number }[]>([]);
    const [occupancyRate, setOccupancyRate] = useState<{ total: number; withPackage: number; rate: number }>({ total: 0, withPackage: 0, rate: 0 });
    const [loadingAdvanced, setLoadingAdvanced] = useState(false);

    // --- State: Revenue Details ---
    const [revenueStartDate, setRevenueStartDate] = useState<string>('');
    const [revenueEndDate, setRevenueEndDate] = useState<string>('');
    const [revenueData, setRevenueData] = useState<{ id: string; memberName: string; amount: number; date: Date; notes?: string }[]>([]);
    const [loadingRevenueDetails, setLoadingRevenueDetails] = useState(false);

    // --- Effects ---

    // 1. Fetch Members
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'members'));
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
                const collator = new Intl.Collator('tr-TR');
                list.sort((a, b) => collator.compare(`${a.name} ${a.surname}`, `${b.name} ${b.surname}`));
                setMembers(list);
            } catch (err) {
                if (import.meta.env.DEV) console.error("Error fetching members:", err);
            }
        };
        fetchMembers();
    }, []);

    // 1b. Fetch Advanced Reports
    useEffect(() => {
        const fetchAdvanced = async () => {
            setLoadingRevenue(true);
            setLoadingAdvanced(true);
            try {
                // Total revenue trend (6 months)
                const now = new Date();
                const trend: MonthlyData[] = [];
                const labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const start = new Date(d.getFullYear(), d.getMonth(), 1);
                    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

                    const q = query(
                        collection(db, 'payments'),
                        where('date', '>=', Timestamp.fromDate(start)),
                        where('date', '<=', Timestamp.fromDate(end))
                    );
                    const snap = await getDocs(q);
                    let total = 0;
                    snap.forEach(doc => { total += doc.data().amount || 0; });
                    trend.push({ label: labels[d.getMonth()], value: total });
                }
                setRevenueTrend(trend);

                // Absence & Occupancy calculation
                const lessonsSnap = await getDocs(collection(db, 'lessons'));
                const membersSnap = await getDocs(collection(db, 'members'));
                const assignedSnap = await getDocs(collection(db, 'assigned_packages'));

                const absenceMap: Record<string, number> = {};
                lessonsSnap.forEach(doc => {
                    const data = doc.data();
                    const scheduled: string[] = data.memberIds || [];
                    const attended: string[] = data.attendedMemberIds || [];

                    scheduled.forEach(id => {
                        if (!attended.includes(id)) {
                            absenceMap[id] = (absenceMap[id] || 0) + 1;
                        }
                    });
                });

                const absList = membersSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        name: `${data.name} ${data.surname}`,
                        absences: absenceMap[doc.id] || 0
                    };
                })
                    .filter(x => x.absences > 0)
                    .sort((a, b) => b.absences - a.absences)
                    .slice(0, 5);
                setAbsenceReport(absList);

                const activeMembers = membersSnap.docs.filter(d => d.data().isActive !== false);
                const packageMemberIds = new Set(assignedSnap.docs.map(d => d.data().memberId));
                const activeWithPkg = activeMembers.filter(d => packageMemberIds.has(d.id)).length;

                setOccupancyRate({
                    total: activeMembers.length,
                    withPackage: activeWithPkg,
                    rate: activeMembers.length > 0 ? (activeWithPkg / activeMembers.length) * 100 : 0
                });

            } catch (err) {
                if (import.meta.env.DEV) console.error('Error fetching advanced reports:', err);
            } finally {
                setLoadingRevenue(false);
                setLoadingAdvanced(false);
            }
        };
        fetchAdvanced();
    }, []);

    // 2. Fetch Yearly Stats (General)
    useEffect(() => {
        const fetchStats = async () => {
            setLoadingStats(true);
            try {
                const startOfYear = new Date(Date.UTC(selectedYear, 0, 1));
                const endOfYear = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59));

                const q = query(
                    collection(db, 'lessons'),
                    where('date', '>=', Timestamp.fromDate(startOfYear)),
                    where('date', '<=', Timestamp.fromDate(endOfYear))
                );

                const snapshot = await getDocs(q);
                const counts = Array(12).fill(0);

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.memberIds) {
                        const date = data.date.toDate();
                        const month = date.getMonth();
                        counts[month] += (data.memberIds as any[]).length;
                    }
                });

                const labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                setMonthlyStats(counts.map((val, i) => ({ label: labels[i], value: val })));

            } catch (err) {
                if (import.meta.env.DEV) console.error("Error fetching stats:", err);
            } finally {
                setLoadingStats(false);
            }
        };
        fetchStats();
    }, [selectedYear]);

    // 3. Fetch Member Attendance
    const fetchAttendance = useCallback(async () => {
        if (!selectedMemberId) return;
        setLoadingAttendance(true);
        setAttendanceData([]);

        try {
            let q;
            const lessonsRef = collection(db, 'lessons');

            if (filterType === 'range' && startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59);

                q = query(
                    lessonsRef,
                    where('memberIds', 'array-contains', selectedMemberId),
                    where('date', '>=', Timestamp.fromDate(start)),
                    where('date', '<=', Timestamp.fromDate(end))
                );
            } else {
                // Month filter
                const start = new Date(reportYear, selectedMonth - 1, 1);
                const end = new Date(reportYear, selectedMonth, 0, 23, 59, 59); // Last day of month

                q = query(
                    lessonsRef,
                    where('memberIds', 'array-contains', selectedMemberId),
                    where('date', '>=', Timestamp.fromDate(start)),
                    where('date', '<=', Timestamp.fromDate(end))
                );
            }

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                date: doc.data().date.toDate(),
                timeSlot: doc.data().timeSlot
            }));

            // Sort by date
            data.sort((a, b) => a.date.getTime() - b.date.getTime());
            setAttendanceData(data);

        } catch (err) {
            if (import.meta.env.DEV) console.error("Error fetching attendance:", err);
        } finally {
            setLoadingAttendance(false);
        }
    }, [selectedMemberId, filterType, startDate, endDate, selectedMonth, reportYear]);

    // Trigger fetch on filter change if member is selected
    useEffect(() => {
        if (selectedMemberId) fetchAttendance();
    }, [fetchAttendance]);

    // --- Options ---
    const memberOptions = useMemo(() => members.map(m => ({
        value: m.id,
        label: `${m.name} ${m.surname}`
    })), [members]);

    const monthOptions = [
        { value: '1', label: 'Ocak' }, { value: '2', label: 'Şubat' }, { value: '3', label: 'Mart' },
        { value: '4', label: 'Nisan' }, { value: '5', label: 'Mayıs' }, { value: '6', label: 'Haziran' },
        { value: '7', label: 'Temmuz' }, { value: '8', label: 'Ağustos' }, { value: '9', label: 'Eylül' },
        { value: '10', label: 'Ekim' }, { value: '11', label: 'Kasım' }, { value: '12', label: 'Aralık' }
    ];

    const yearOptions = Array.from({ length: 5 }, (_, i) => {
        const y = new Date().getFullYear() - i;
        return { value: y.toString(), label: y.toString() };
    });

    const handleExportCSV = () => {
        const headers = ['Üye', 'Tarih', 'Saat'];
        const rows = attendanceData.map(d => [
            members.find(m => m.id === selectedMemberId)?.name + ' ' + members.find(m => m.id === selectedMemberId)?.surname,
            d.date.toLocaleDateString('tr-TR'),
            d.timeSlot
        ]);

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `katilim_raporu_${selectedMemberId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fetchRevenueDetails = useCallback(async () => {
        if (!revenueStartDate || !revenueEndDate) return;
        setLoadingRevenueDetails(true);
        try {
            const start = new Date(revenueStartDate);
            const end = new Date(revenueEndDate);
            end.setHours(23, 59, 59);

            const q = query(
                collection(db, 'payments'),
                where('date', '>=', Timestamp.fromDate(start)),
                where('date', '<=', Timestamp.fromDate(end))
            );
            const snap = await getDocs(q);
            
            const data = snap.docs.map(doc => {
                const d = doc.data() as any;
                const member = members.find(m => m.id === d.memberId);
                return {
                    id: doc.id,
                    memberName: member ? `${member.name} ${member.surname}` : 'Bilinmeyen Üye',
                    amount: d.amount || 0,
                    date: d.date?.toDate() || new Date(),
                    notes: d.notes
                };
            });
            data.sort((a,b) => b.date.getTime() - a.date.getTime());
            setRevenueData(data);
        } catch (e) {
            if (import.meta.env.DEV) console.error("Error fetching revenue details:", e);
        } finally {
            setLoadingRevenueDetails(false);
        }
    }, [revenueStartDate, revenueEndDate, members]);

    useEffect(() => {
        fetchRevenueDetails();
    }, [fetchRevenueDetails]);

    const handleExportRevenueCSV = () => {
        const headers = ['Üye', 'Tarih', 'Tutar', 'Not'];
        const rows = revenueData.map(d => [
            d.memberName,
            d.date.toLocaleDateString('tr-TR'),
            d.amount.toString(),
            d.notes || ''
        ]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `gelir_detay_raporu.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Chart Helpers
    const maxStatValue = Math.max(...monthlyStats.map(s => s.value), 1);
    const maxRevenueValue = Math.max(...revenueTrend.map(s => s.value), 1);

    return (
        <AppShell
            header={<Header title="Raporlar" />}
            bottomNav={<BottomNav />}
        >
            <div className="reports-page">

                {/* Section 1: General Stats */}
                <Card className="report-card" padding="md">
                    <div className="card-header-row">
                        <h3 className="card-title"><FiBarChart2 /> Yıllık Genel Bakış</h3>
                        <div className="year-selector">
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(parseInt(e.target.value))}
                                className="native-select"
                            >
                                {yearOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loadingStats ? (
                        <div className="loading-state">Yükleniyor...</div>
                    ) : (
                        <div className="chart-container">
                            <div className="bar-chart">
                                {monthlyStats.map((stat, idx) => (
                                    <div key={idx} className="chart-col">
                                        <div
                                            className="chart-bar"
                                            style={{ height: `${(stat.value / maxStatValue) * 100}%` }}
                                            data-value={stat.value}
                                        ></div>
                                        <span className="chart-label">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Section 1b: Revenue Trend */}
                <Card className="report-card" padding="md">
                    <div className="card-header-row">
                        <h3 className="card-title"><FiDollarSign /> Son 6 Ay Gelir Trendi</h3>
                    </div>

                    {loadingRevenue ? (
                        <div className="loading-state">Yükleniyor...</div>
                    ) : (
                        <div className="chart-container">
                            <div className="bar-chart">
                                {revenueTrend.map((stat, idx) => (
                                    <div key={idx} className="chart-col">
                                        <div
                                            className="chart-bar chart-bar--revenue"
                                            style={{ height: `${(stat.value / maxRevenueValue) * 100}%` }}
                                            data-value={stat.value > 0 ? `₺${stat.value.toLocaleString('tr-TR')}` : '0'}
                                        ></div>
                                        <span className="chart-label">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Section 1c: Top Absences & Occupancy */}
                <div className="reports-grid-two">
                    <Card className="report-card" padding="md">
                        <div className="card-header-row">
                            <h3 className="card-title"><FiUserX /> En Çok Devamsızlık</h3>
                        </div>
                        {loadingAdvanced ? (
                            <div className="loading-state">Yükleniyor...</div>
                        ) : absenceReport.length === 0 ? (
                            <div className="empty-state">Kayıt yok.</div>
                        ) : (
                            <div className="absence-list">
                                {absenceReport.map((item, idx) => (
                                    <div key={idx} className="absence-item">
                                        <span className="absence-name">{item.name}</span>
                                        <span className="absence-count">{item.absences} ders</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="report-card" padding="md">
                        <div className="card-header-row">
                            <h3 className="card-title"><FiPieChart /> Paket Doluluk Oranı</h3>
                        </div>
                        {loadingAdvanced ? (
                            <div className="loading-state">Yükleniyor...</div>
                        ) : (
                            <div className="occupancy-stats">
                                <div className="occupancy-circle">
                                    <span className="occupancy-value">{Math.round(occupancyRate.rate)}%</span>
                                </div>
                                <div className="occupancy-info">
                                    <p>Toplam Aktif Üye: <strong>{occupancyRate.total}</strong></p>
                                    <p>Paketi Olan: <strong>{occupancyRate.withPackage}</strong></p>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Section 2: Member Attendance */}
                <Card className="report-card" padding="md">
                    <div className="card-header-row">
                        <h3 className="card-title"><FiUser /> Üye Katılım Raporu</h3>
                        {attendanceData.length > 0 && (
                            <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={<FiDownload />}
                                onClick={handleExportCSV}
                            >
                                CSV İndir
                            </Button>
                        )}
                    </div>

                    <div className="filters-grid">
                        <Select
                            label="Üye Seçin"
                            options={memberOptions}
                            value={selectedMemberId}
                            onChange={e => setSelectedMemberId(e.target.value)}
                            placeholder="Üye seçiniz..."
                            fullWidth
                        />

                        <div className="filter-type-toggle">
                            <label>
                                <input
                                    type="radio"
                                    checked={filterType === 'month'}
                                    onChange={() => setFilterType('month')}
                                /> Aylık
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    checked={filterType === 'range'}
                                    onChange={() => setFilterType('range')}
                                /> Tarih Aralığı
                            </label>
                        </div>

                        {filterType === 'month' ? (
                            <div className="month-year-row">
                                <Select
                                    label="Ay"
                                    options={monthOptions}
                                    value={selectedMonth.toString()}
                                    onChange={e => setSelectedMonth(parseInt(e.target.value))}
                                />
                                <Select
                                    label="Yıl"
                                    options={yearOptions}
                                    value={reportYear.toString()}
                                    onChange={e => setReportYear(parseInt(e.target.value))}
                                />
                            </div>
                        ) : (
                            <div className="date-range-row">
                                <Input
                                    type="date"
                                    label="Başlangıç"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                                <Input
                                    type="date"
                                    label="Bitiş"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {selectedMemberId && (
                        <div className="attendance-results">
                            <div className="results-header">
                                <span>Toplam Ders: <strong>{attendanceData.length}</strong></span>
                            </div>

                            {loadingAttendance ? (
                                <div className="loading-state">Veriler getiriliyor...</div>
                            ) : attendanceData.length > 0 ? (
                                <div className="attendance-list">
                                    {attendanceData.map((record, idx) => (
                                        <div key={idx} className="attendance-item">
                                            <FiCalendar size={14} />
                                            <span className="date">
                                                {record.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </span>
                                            <span className="time">
                                                {record.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {/* Note: timeSlot usage depends on your data model, here using date time */}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">Kayıt bulunamadı.</div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Section 3: Revenue Details */}
                <Card className="report-card mt-6" padding="md">
                    <div className="card-header-row">
                        <h3 className="card-title"><FiDollarSign /> Gelir Detay Raporu</h3>
                        {revenueData.length > 0 && (
                            <Button variant="secondary" size="sm" leftIcon={<FiDownload />} onClick={handleExportRevenueCSV}>CSV İndir</Button>
                        )}
                    </div>
                    <div className="date-range-row mb-4">
                        <Input type="date" label="Başlangıç" value={revenueStartDate} onChange={e => setRevenueStartDate(e.target.value)} />
                        <Input type="date" label="Bitiş" value={revenueEndDate} onChange={e => setRevenueEndDate(e.target.value)} />
                    </div>
                    {revenueStartDate && revenueEndDate && (
                        <div className="attendance-results">
                            <div className="results-header">
                                <span>Toplam Gelir: <strong>{revenueData.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('tr-TR')} TL</strong></span>
                            </div>
                            {loadingRevenueDetails ? (
                                <div className="loading-state">Yükleniyor...</div>
                            ) : revenueData.length > 0 ? (
                                <div className="attendance-list">
                                    {revenueData.map((record) => (
                                        <div key={record.id} className="attendance-item flex justify-between w-full">
                                            <div>
                                                <strong>{record.memberName}</strong>
                                                <div className="text-xs text-gray-500">{record.date.toLocaleDateString('tr-TR')} {record.notes && `- ${record.notes}`}</div>
                                            </div>
                                            <div className="font-bold text-green-600">+{record.amount.toLocaleString('tr-TR')} TL</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">Kayıt bulunamadı.</div>
                            )}
                        </div>
                    )}
                </Card>

            </div>
        </AppShell>
    );
};

export default ReportsPage;
