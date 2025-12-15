// src/design-system/pages/CalendarPage/CalendarPage.tsx
// Yeni design system ile modern takvim sayfası

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useMembers } from '../../../hooks/useMembers';
import { AppShell, Header, BottomNav, Button, Card, Avatar, AvatarGroup, Badge, Modal, ModalFooter } from '../../components';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiPlus, FiUsers, FiUserCheck } from 'react-icons/fi';
import { clsx } from 'clsx';
import './CalendarPage.css';

type ViewMode = 'week' | 'day';

interface Lesson {
    id: string;
    date: Date;
    title?: string;
    memberIds: string[];
    notes?: string;
    status: 'scheduled' | 'completed' | 'cancelled';
}

export const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

    const { members } = useMembers(false);

    // Tarih aralığını hesapla
    const dateRange = useMemo(() => {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);

        if (viewMode === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi başlangıç
            start.setDate(diff);
            end.setDate(start.getDate() + 6);
        }

        return { start, end };
    }, [currentDate, viewMode]);

    // Lessons fetch effect
    useEffect(() => {
        const fetchLessons = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'lessons'),
                    where('date', '>=', Timestamp.fromDate(dateRange.start)),
                    where('date', '<=', Timestamp.fromDate(dateRange.end))
                );

                const snapshot = await getDocs(q);
                const fetchedLessons: Lesson[] = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    fetchedLessons.push({
                        id: doc.id,
                        date: data.date.toDate(),
                        title: data.title,
                        memberIds: data.memberIds || [],
                        notes: data.notes,
                        status: data.status || 'scheduled'
                    });
                });

                setLessons(fetchedLessons);
            } catch (error) {
                console.error('Dersler yüklenirken hata:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLessons();
    }, [dateRange]);

    const handlePrev = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
        else newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
        else newDate.setDate(newDate.getDate() + 1);
        setCurrentDate(newDate);
    };

    const handleToday = () => setCurrentDate(new Date());

    const getDayLessons = (date: Date) => {
        return lessons.filter(l =>
            l.date.getDate() === date.getDate() &&
            l.date.getMonth() === date.getMonth() &&
            l.date.getFullYear() === date.getFullYear()
        ).sort((a, b) => a.date.getTime() - b.date.getTime());
    };

    // Haftanın günlerini oluştur
    const weekDays = useMemo(() => {
        const days = [];
        const start = new Date(dateRange.start);
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push(day);
        }
        return days;
    }, [dateRange]);

    return (
        <AppShell
            header={
                <Header
                    title="Takvim"
                    className="calendar-header"
                    rightAction={
                        <div className="calendar-actions">
                            <div className="calendar-view-toggle">
                                <button
                                    className={clsx('view-btn', { active: viewMode === 'day' })}
                                    onClick={() => setViewMode('day')}
                                >
                                    Gün
                                </button>
                                <button
                                    className={clsx('view-btn', { active: viewMode === 'week' })}
                                    onClick={() => setViewMode('week')}
                                >
                                    Hafta
                                </button>
                            </div>
                            <Button variant="primary" size="sm" leftIcon={<FiPlus />}>
                                Ders Ekle
                            </Button>
                        </div>
                    }
                />
            }
            bottomNav={<BottomNav />}
        >
            <div className="calendar-page">
                {/* Date Navigation */}
                <div className="calendar-nav">
                    <Button variant="ghost" size="sm" onClick={handlePrev}><FiChevronLeft /></Button>
                    <h2 className="current-date">
                        {currentDate.toLocaleDateString('tr-TR', {
                            month: 'long',
                            year: 'numeric',
                            day: viewMode === 'day' ? 'numeric' : undefined
                        })}
                        {viewMode === 'day' && <span className="weekday-label">{currentDate.toLocaleDateString('tr-TR', { weekday: 'long' })}</span>}
                    </h2>
                    <Button variant="ghost" size="sm" onClick={handleNext}><FiChevronRight /></Button>
                    <Button variant="secondary" size="sm" onClick={handleToday} className="today-btn">Bugün</Button>
                </div>

                {loading ? (
                    <div className="calendar-loading">
                        <div className="calendar-spinner" />
                        <p>Dersler yükleniyor...</p>
                    </div>
                ) : (
                    <div className="calendar-grid">
                        {viewMode === 'week' ? (
                            <div className="week-view">
                                {weekDays.map((day, index) => {
                                    const dayLessons = getDayLessons(day);
                                    const isToday = day.toDateString() === new Date().toDateString();

                                    return (
                                        <div key={index} className={clsx('week-day', { 'is-today': isToday })}>
                                            <div className="week-day-header">
                                                <span className="day-name">{day.toLocaleDateString('tr-TR', { weekday: 'short' })}</span>
                                                <span className="day-number">{day.getDate()}</span>
                                            </div>
                                            <div className="day-lessons">
                                                {dayLessons.map(lesson => (
                                                    <div
                                                        key={lesson.id}
                                                        className={`lesson-item lesson-${lesson.status}`}
                                                        onClick={() => setSelectedLesson(lesson)}
                                                    >
                                                        <span className="lesson-time">
                                                            {lesson.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className="lesson-title">
                                                            {lesson.title || 'Ders'}
                                                        </span>
                                                        <div className="lesson-members-count">
                                                            <FiUsers size={10} /> {lesson.memberIds.length}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="day-view">
                                <div className="time-slots">
                                    {Array.from({ length: 15 }, (_, i) => i + 7).map(hour => { // 07:00 - 21:00
                                        const time = `${hour.toString().padStart(2, '0')}:00`;
                                        const slotLessons = getDayLessons(currentDate).filter(l => l.date.getHours() === hour);

                                        return (
                                            <div key={hour} className="time-slot">
                                                <div className="time-label">{time}</div>
                                                <div className="slot-content">
                                                    {slotLessons.map(lesson => (
                                                        <Card
                                                            key={lesson.id}
                                                            className={`day-lesson-card lesson-${lesson.status}`}
                                                            onClick={() => setSelectedLesson(lesson)}
                                                            interactive
                                                            padding="sm"
                                                        >
                                                            <div className="day-lesson-header">
                                                                <div className="day-lesson-time">
                                                                    <FiClock /> {lesson.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                                <Badge variant={lesson.status === 'completed' ? 'success' : 'primary'} size="sm">
                                                                    {lesson.status === 'completed' ? 'Tamamlandı' : 'Planlı'}
                                                                </Badge>
                                                            </div>
                                                            <div className="day-lesson-title">{lesson.title || 'Ders'}</div>
                                                            <div className="day-lesson-members">
                                                                <AvatarGroup max={3} size="xs">
                                                                    {lesson.memberIds.map(id => {
                                                                        const member = members.find(m => m.id === id);
                                                                        return <Avatar key={id} name={member ? `${member.name} ${member.surname}` : 'Üye'} />;
                                                                    })}
                                                                </AvatarGroup>
                                                                <span className="member-count-text">{lesson.memberIds.length} katılımcı</span>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Lesson Detail Modal */}
                <Modal
                    isOpen={!!selectedLesson}
                    onClose={() => setSelectedLesson(null)}
                    title="Ders Detayı"
                >
                    {selectedLesson && (
                        <div className="lesson-detail">
                            <div className="lesson-detail-header">
                                <div className="lesson-detail-date">
                                    <FiCalendar />
                                    <span>
                                        {selectedLesson.date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        {', '}
                                        {selectedLesson.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            <div className="lesson-detail-section">
                                <h4>Katılımcılar ({selectedLesson.memberIds.length})</h4>
                                <div className="lesson-members-list">
                                    {selectedLesson.memberIds.map(id => {
                                        const member = members.find(m => m.id === id);
                                        return (
                                            <div key={id} className="lesson-member-item">
                                                <Avatar name={member ? `${member.name} ${member.surname}` : 'Üye'} size="sm" />
                                                <span>{member ? `${member.name} ${member.surname}` : 'Bilinmeyen Üye'}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedLesson.notes && (
                                <div className="lesson-detail-section">
                                    <h4>Notlar</h4>
                                    <p>{selectedLesson.notes}</p>
                                </div>
                            )}

                            <ModalFooter>
                                <Button variant="danger" onClick={() => {/* Delete logic */ }}>Sil</Button>
                                <Button variant="secondary" onClick={() => setSelectedLesson(null)}>Kapat</Button>
                                <Button variant="primary" leftIcon={<FiUserCheck />}>Yoklama Al</Button>
                            </ModalFooter>
                        </div>
                    )}
                </Modal>
            </div>
        </AppShell>
    );
};

export default CalendarPage;
