// src/hooks/useMemberLessons.ts
// Üye ders/randevu yönetimi hook'u

import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    arrayRemove,
    serverTimestamp,
    onSnapshot,
    getDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { toJSDate, TZ } from '../utils/dateHelpers';

// Ders tipi
export interface MemberLesson {
    id: string;
    date: Date;
    isAttended: boolean;
    isAbsent: boolean;
    isWalkIn: boolean;
}

// Detaylı ders tipi
export interface DetailedLesson extends MemberLesson {
    memberCount: number;
    attendedCount: number;
    formattedDate: string;
    formattedTime: string;
}

interface UseMemberLessonsOptions {
    memberId: string;
    realtime?: boolean;
    startDate?: Date;
    endDate?: Date;
}

// Tarih formatla (Europe/Istanbul timezone)
const formatLessonDateTime = (dt: Date): { date: string; time: string } => {
    const parts = new Intl.DateTimeFormat('tr-TR', {
        timeZone: TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(dt);

    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return {
        date: `${get('day')}.${get('month')}.${get('year')}`,
        time: `${get('hour')}:${get('minute')}`,
    };
};

export function useMemberLessons(options: UseMemberLessonsOptions) {
    const { memberId, realtime = false, startDate, endDate } = options;

    const [lessons, setLessons] = useState<DetailedLesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dersleri işle (snapshot.docs için)
    const processDocs = useCallback((docs: import('firebase/firestore').QueryDocumentSnapshot<import('firebase/firestore').DocumentData, import('firebase/firestore').DocumentData>[]) => {
        const lessonList: DetailedLesson[] = [];

        for (const docSnap of docs) {
            const data = docSnap.data();
            const dt = toJSDate(data?.date);
            if (!dt) continue;

            // Tarih aralığı filtresi
            if (startDate && dt < startDate) continue;
            if (endDate && dt > endDate) continue;

            const memberIds: string[] = data.memberIds || [];
            const attendedMemberIds: string[] = data.attendedMemberIds || [];
            const absentMemberIds: string[] = data.absentMemberIds || [];
            const walkInMemberIds: string[] = data.walkInMemberIds || [];

            const formatted = formatLessonDateTime(dt);

            lessonList.push({
                id: docSnap.id,
                date: dt,
                isAttended: attendedMemberIds.includes(memberId),
                isAbsent: absentMemberIds.includes(memberId),
                isWalkIn: walkInMemberIds.includes(memberId),
                memberCount: memberIds.length,
                attendedCount: attendedMemberIds.length,
                formattedDate: formatted.date,
                formattedTime: formatted.time,
            });
        }

        // Tarihe göre sırala
        lessonList.sort((a, b) => a.date.getTime() - b.date.getTime());
        return lessonList;
    }, [memberId, startDate, endDate]);

    // Dersleri getir
    const fetchLessons = useCallback(async () => {
        if (!memberId) {
            setLessons([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const q = query(
                collection(db, 'lessons'),
                where('memberIds', 'array-contains', memberId)
            );
            const snapshot = await getDocs(q);

            const lessonList = processDocs(snapshot.docs);
            setLessons(lessonList);
        } catch (err) {
            console.error('Error fetching member lessons:', err);
            setError('Dersler yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    }, [memberId, startDate, endDate]);

    // Realtime listener veya tek seferlik fetch
    useEffect(() => {
        if (!memberId) {
            setLessons([]);
            setLoading(false);
            return;
        }

        if (realtime) {
            const q = query(
                collection(db, 'lessons'),
                where('memberIds', 'array-contains', memberId)
            );
            const unsubscribe = onSnapshot(
                q,
                (snapshot) => {
                    const lessonList = processDocs(snapshot.docs);
                    setLessons(lessonList);
                    setLoading(false);
                },
                (err) => {
                    console.error('Realtime listener error:', err);
                    setError(err.message);
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            fetchLessons();
        }
    }, [memberId, realtime, fetchLessons]);

    // Üyeyi dersten çıkar
    const removeFromLesson = useCallback(async (lessonId: string, memberUid?: string) => {
        if (!memberId || !lessonId) return false;

        try {
            const lessonRef = doc(db, 'lessons', lessonId);

            // Üyeyi tüm listelerden çıkar
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: { [key: string]: any } = {
                memberIds: arrayRemove(memberId),
                attendedMemberIds: arrayRemove(memberId),
                absentMemberIds: arrayRemove(memberId),
                walkInMemberIds: arrayRemove(memberId),
                updatedAt: serverTimestamp(),
            };

            if (memberUid) {
                updateData.memberUids = arrayRemove(memberUid);
                updateData.attendedMemberUids = arrayRemove(memberUid);
                updateData.absentMemberUids = arrayRemove(memberUid);
                updateData.walkInMemberUids = arrayRemove(memberUid);
            }

            await updateDoc(lessonRef, updateData);

            // Ders boş mu kontrol et, boşsa sil
            const lessonSnap = await getDoc(lessonRef);
            if (lessonSnap.exists()) {
                const data = lessonSnap.data();
                const memberIds = data?.memberIds || [];
                const walkInIds = data?.walkInMemberIds || [];

                if (memberIds.length === 0 && walkInIds.length === 0) {
                    await deleteDoc(lessonRef);
                }
            }

            // UI güncelle
            setLessons(prev => prev.filter(l => l.id !== lessonId));
            return true;
        } catch (err) {
            console.error('Error removing from lesson:', err);
            setError('Dersten çıkarılırken bir hata oluştu.');
            return false;
        }
    }, [memberId]);

    // İstatistikler
    const stats = {
        total: lessons.length,
        attended: lessons.filter(l => l.isAttended).length,
        absent: lessons.filter(l => l.isAbsent).length,
        upcoming: lessons.filter(l => l.date > new Date()).length,
        past: lessons.filter(l => l.date <= new Date()).length,
    };

    // Yaklaşan dersler
    const upcomingLessons = lessons.filter(l => l.date > new Date());

    // Geçmiş dersler
    const pastLessons = lessons.filter(l => l.date <= new Date()).reverse();

    return {
        lessons,
        upcomingLessons,
        pastLessons,
        stats,
        loading,
        error,
        refetch: fetchLessons,
        removeFromLesson,
    };
}

export default useMemberLessons;
