// src/hooks/useFirestore.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

  // Stabilize constraints reference to prevent infinite re-renders
  // We use a ref to store the previous constraints and only update if they actually changed
  const constraintsRef = useRef(constraints);
  const constraintsKey = useMemo(() => {
    // Create a stable key based on constraint types/values
    // For simple cases (empty array), this prevents re-renders
    return constraints.length === 0 ? 'empty' : `constraints-${constraints.length}`;
  }, [constraints.length]);

  // Update ref only when constraints actually change
  useEffect(() => {
    constraintsRef.current = constraints;
  }, [constraintsKey]);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const collectionRef = collection(db, collectionName);
      const currentConstraints = constraintsRef.current;
      const q = currentConstraints.length > 0 ? query(collectionRef, ...currentConstraints) : collectionRef;
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setData(items);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [collectionName, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const collectionRef = collection(db, collectionName);
    const currentConstraints = constraintsRef.current;
    const q = currentConstraints.length > 0 ? query(collectionRef, ...currentConstraints) : collectionRef;

    if (realtime) {
      // Real-time listener
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
  }, [collectionName, realtime, enabled, constraintsKey, fetchData]);

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
