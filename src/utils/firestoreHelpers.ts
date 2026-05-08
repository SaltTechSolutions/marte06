import type { DocumentData, QueryDocumentSnapshot, DocumentSnapshot } from 'firebase/firestore';

/**
 * Extracts and casts data from a Firestore document snapshot safely.
 * Allows strongly typed extraction of document fields.
 * 
 * @param docSnap Firestore document snapshot
 * @returns The document data cast to the provided generic type T
 */
export function getTypedData<T = Record<string, unknown>>(
  docSnap: QueryDocumentSnapshot<DocumentData, DocumentData> | DocumentSnapshot<DocumentData, DocumentData>
): T {
  const data = docSnap.data();
  return (data || {}) as T;
}

/**
 * Similar to getTypedData, but also injects the document ID into the object.
 * Useful when the interface extends a base object that requires an ID.
 */
export function getTypedDataWithId<T = Record<string, unknown>>(
  docSnap: QueryDocumentSnapshot<DocumentData, DocumentData> | DocumentSnapshot<DocumentData, DocumentData>
): T & { id: string } {
  const data = docSnap.data();
  return {
    ...(data as any),
    id: docSnap.id,
  } as T & { id: string };
}
