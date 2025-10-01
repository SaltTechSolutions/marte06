// src/hooks/useLessons.ts
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Lesson {
  id: string;
  date: Date;
  memberIds: string[];
  attendedMemberIds: string[];
  absentMemberIds: string[];
  walkInMemberIds: string[];
}

export const useLessons = (startDate: Date, endDate: Date) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLessons = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'lessons'),
          where('date', '>=', Timestamp.fromDate(startDate)),
          where('date', '<=', Timestamp.fromDate(endDate))
        );
        const snapshot = await getDocs(q);
        const list: Lesson[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            date: data.date?.toDate?.() || new Date(data.date?.seconds * 1000),
            memberIds: data.memberIds || [],
            attendedMemberIds: data.attendedMemberIds || [],
            absentMemberIds: data.absentMemberIds || [],
            walkInMemberIds: data.walkInMemberIds || [],
          };
        });
        setLessons(list);
      } catch (e: any) {
        console.error('Error fetching lessons:', e);
        setError(e.message || 'Dersler yüklenirken hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [startDate, endDate]);

  return { lessons, setLessons, loading, error };
};
