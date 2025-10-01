// src/hooks/useMembers.ts
import { useMemo } from 'react';
import { useFirestoreCollection } from './useFirestore';
import type { Timestamp } from 'firebase/firestore';

export interface Member {
  id: string;
  name?: string;
  surname?: string;
  birthDate?: Timestamp | Date | string | null;
  memberUid?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export const useMembers = (realtime = true) => {
  const { data: membersData, loading } = useFirestoreCollection('members', [], {
    realtime
  });

  const members = useMemo(() => membersData as Member[], [membersData]);

  // Turkish alphabetical sorting
  const sortedMembers = useMemo(() => {
    const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
    return [...members].sort((a, b) =>
      collator.compare(
        `${a.name ?? ''} ${a.surname ?? ''}`.trim(),
        `${b.name ?? ''} ${b.surname ?? ''}`.trim()
      )
    );
  }, [members]);

  return { members, sortedMembers, loading };
};
