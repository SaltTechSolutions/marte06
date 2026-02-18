// src/hooks/useAssignedPackages.ts
// Üye paket yönetimi hook'u

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    Timestamp,
    onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { toJSDate } from '../utils/dateHelpers';

// Atanmış paket tipi
export interface AssignedPackage {
    id: string;
    memberId: string;
    packageId: string;
    packageName: string;
    startDate: Timestamp;
    endDate: Timestamp | null;
    assignedAt: Timestamp;
    totalLessonCount: number | null;
    packagePrice: number | null;
    // Hesaplanan değerler
    attendedLessons: number;
    remainingLessons: number;
    isActive: boolean;
    isExpired: boolean;
    daysRemaining: number | null;
}

// Paket tipi (packages collection'dan)
export interface Package {
    id: string;
    name: string;
    description?: string;
    price: number;
    lessonCount?: number;
    durationDays?: number;
    isActive: boolean;
}

interface UseAssignedPackagesOptions {
    memberId: string;
    realtime?: boolean;
    fetchLessonCounts?: boolean;
}

export function useAssignedPackages(options: UseAssignedPackagesOptions) {
    const { memberId, realtime = false, fetchLessonCounts = true } = options;

    const [assignedPackages, setAssignedPackages] = useState<AssignedPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Paketleri getir ve ders sayılarını hesapla
    const fetchPackages = useCallback(async () => {
        if (!memberId) {
            setAssignedPackages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Atanmış paketleri getir
            const q = query(collection(db, 'assigned_packages'), where('memberId', '==', memberId));
            const snapshot = await getDocs(q);

            const packages: AssignedPackage[] = [];
            const now = new Date();

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();

                // Paket adını getir
                let packageName = data.packageName || 'Bilinmeyen Paket';
                if (!data.packageName && data.packageId) {
                    try {
                        const pkgDoc = await getDoc(doc(db, 'packages', data.packageId));
                        if (pkgDoc.exists()) {
                            packageName = (pkgDoc.data() as Package).name;
                        }
                    } catch {
                        // Ignore, use default
                    }
                }

                const startDate = data.startDate as Timestamp;
                const endDate = data.endDate as Timestamp | null;
                const startJs = toJSDate(startDate);
                const endJs = toJSDate(endDate);

                // Aktif ve süresi dolmuş durumunu hesapla
                const isActive = startJs && endJs ? (startJs <= now && now <= endJs) : !!startJs && startJs <= now;
                const isExpired = endJs ? now > endJs : false;

                // Kalan gün hesapla
                let daysRemaining: number | null = null;
                if (endJs && !isExpired) {
                    daysRemaining = Math.ceil((endJs.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                }

                packages.push({
                    id: docSnap.id,
                    memberId: data.memberId,
                    packageId: data.packageId,
                    packageName,
                    startDate,
                    endDate,
                    assignedAt: data.assignedAt,
                    totalLessonCount: data.totalLessonCount ?? null,
                    packagePrice: data.packagePrice ?? null,
                    attendedLessons: 0,
                    remainingLessons: data.totalLessonCount ?? 0,
                    isActive,
                    isExpired,
                    daysRemaining,
                });
            }

            // Katınlan ders sayılarını hesapla
            if (fetchLessonCounts && packages.length > 0) {
                const lessonsQ = query(
                    collection(db, 'lessons'),
                    where('memberIds', 'array-contains', memberId)
                );
                const lessonsSnap = await getDocs(lessonsQ);

                const lessons = lessonsSnap.docs
                    .map(d => {
                        const raw = d.data();
                        const dt = toJSDate(raw?.date);
                        const attendedIds: string[] = Array.isArray(raw?.attendedMemberIds)
                            ? raw.attendedMemberIds
                            : [];
                        return dt ? { date: dt, attendedIds } : null;
                    })
                    .filter((x): x is { date: Date; attendedIds: string[] } => Boolean(x));

                // Her paket için katılım sayısını hesapla
                for (const pkg of packages) {
                    const start = toJSDate(pkg.startDate);
                    const end = toJSDate(pkg.endDate) || now;

                    if (start) {
                        const attended = lessons.filter(
                            l => l.date >= start && l.date <= end && l.attendedIds.includes(memberId)
                        ).length;

                        pkg.attendedLessons = attended;
                        pkg.remainingLessons = Math.max(0, (pkg.totalLessonCount || 0) - attended);
                    }
                }
            }

            // Tarihe göre sırala (en yeni önce)
            packages.sort((a, b) => {
                const aDate = toJSDate(a.assignedAt);
                const bDate = toJSDate(b.assignedAt);
                if (!aDate || !bDate) return 0;
                return bDate.getTime() - aDate.getTime();
            });

            setAssignedPackages(packages);
        } catch (err) {
            if (import.meta.env.DEV) console.error('Error fetching assigned packages:', err);
            setError('Atanmış paketler yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    }, [memberId, fetchLessonCounts]);

    // Realtime listener veya tek seferlik fetch
    useEffect(() => {
        if (!memberId) {
            setAssignedPackages([]);
            setLoading(false);
            return;
        }

        if (realtime) {
            const q = query(collection(db, 'assigned_packages'), where('memberId', '==', memberId));
            const unsubscribe = onSnapshot(
                q,
                () => {
                    // Re-fetch on any change (snapshot triggers a full re-fetch)
                    fetchPackages();
                },
                (err) => {
                    if (import.meta.env.DEV) console.error('Realtime listener error:', err);
                    setError(err.message);
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            fetchPackages();
        }
    }, [memberId, realtime, fetchPackages]);

    // Aktif paket
    const activePackage = useMemo(
        () => assignedPackages.find(p => p.isActive) ?? null,
        [assignedPackages]
    );

    // Toplam kalan ders
    const totalRemainingLessons = useMemo(
        () => assignedPackages.reduce((sum, p) => sum + (p.remainingLessons || 0), 0),
        [assignedPackages]
    );

    // Paket sil
    const deletePackage = useCallback(async (packageId: string) => {
        try {
            await deleteDoc(doc(db, 'assigned_packages', packageId));
            setAssignedPackages(prev => prev.filter(p => p.id !== packageId));
            return true;
        } catch (err) {
            if (import.meta.env.DEV) console.error('Error deleting package:', err);
            setError('Paket silinirken bir hata oluştu.');
            return false;
        }
    }, []);

    // Paket ata
    const assignPackage = useCallback(async (
        pkgData: {
            packageId: string;
            startDate: Date;
            endDate?: Date | null;
            totalLessonCount?: number | null;
            packagePrice?: number | null;
        }
    ) => {
        if (!memberId) return null;

        try {
            const docRef = await addDoc(collection(db, 'assigned_packages'), {
                memberId,
                packageId: pkgData.packageId,
                startDate: Timestamp.fromDate(pkgData.startDate),
                endDate: pkgData.endDate ? Timestamp.fromDate(pkgData.endDate) : null,
                assignedAt: serverTimestamp(),
                totalLessonCount: pkgData.totalLessonCount ?? null,
                packagePrice: pkgData.packagePrice ?? null,
            });

            // Listeyi yenile
            await fetchPackages();
            return docRef.id;
        } catch (err) {
            if (import.meta.env.DEV) console.error('Error assigning package:', err);
            setError('Paket atanırken bir hata oluştu.');
            return null;
        }
    }, [memberId, fetchPackages]);

    return {
        assignedPackages,
        activePackage,
        totalRemainingLessons,
        loading,
        error,
        refetch: fetchPackages,
        deletePackage,
        assignPackage,
    };
}

export default useAssignedPackages;
