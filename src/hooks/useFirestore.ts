// src/hooks/useFirestore.ts
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  onSnapshot,
  QueryConstraint
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Custom hook for fetching Firestore data with loading and error states
 */
export function useFirestoreCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  options: {
    realtime?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { realtime = false, enabled = true } = options;
  
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const collectionRef = collection(db, collectionName);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setData(items);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [collectionName, constraints, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (realtime) {
      // Real-time listener
      const collectionRef = collection(db, collectionName);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          setData(items);
          setLoading(false);
        },
        (err) => {
          console.error(`Error in realtime listener for ${collectionName}:`, err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      // One-time fetch
      fetchData();
    }
  }, [collectionName, realtime, enabled, fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for sorted members with Turkish collation
 */
export function useSortedMembers(members: any[]) {
  const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
  
  return [...members].sort((a, b) =>
    collator.compare(
      `${a.name ?? ''} ${a.surname ?? ''}`.trim(),
      `${b.name ?? ''} ${b.surname ?? ''}`.trim()
    )
  );
}
