// src/design-system/pages/ReportsPage/ReportsPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { AppShell, Header, BottomNav, Card, Select, Input } from '../../components';
import { FiBarChart2, FiCalendar, FiUser } from 'react-icons/fi';
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

    // Filters
    const [filterType, setFilterType] = useState<'month' | 'range'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // --- Effects ---

    // 1. Fetch Members
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'members'));
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
                // Sort by name
                const collator = new Intl.Collator('tr-TR');
                list.sort((a, b) => collator.compare(`${a.name} ${a.surname}`, `${b.name} ${b.surname}`));
                setMembers(list);
            } catch (err) {
                console.error("Error fetching members:", err);
            }
        };
        fetchMembers();
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
                        const date = data.date.toDate(); // Firestore timestamp to JS Date
                        const month = date.getMonth();
                        counts[month] += (data.memberIds as any[]).length;
                    }
                });

                const labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                setMonthlyStats(counts.map((val, i) => ({ label: labels[i], value: val })));

            } catch (err) {
                console.error("Error fetching stats:", err);
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
            console.error("Error fetching attendance:", err);
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

    // Chart Helpers
    const maxStatValue = Math.max(...monthlyStats.map(s => s.value), 1);

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

                {/* Section 2: Member Attendance */}
                <Card className="report-card" padding="md">
                    <div className="card-header-row">
                        <h3 className="card-title"><FiUser /> Üye Katılım Raporu</h3>
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

            </div>
        </AppShell>
    );
};

export default ReportsPage;
