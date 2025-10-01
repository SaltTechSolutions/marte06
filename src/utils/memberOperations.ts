// src/utils/memberOperations.ts
import { db } from '../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc, 
  Timestamp,
  arrayRemove 
} from 'firebase/firestore';

/**
 * Safely delete a member with cascade logic
 * - Deletes member document
 * - Deletes all assigned_packages
 * - Removes member from future lessons (keeps past lessons for history)
 * - Optionally deletes payment records
 */
export async function deleteMemberWithCascade(
  memberId: string,
  memberUid?: string,
  options: {
    deletePayments?: boolean;
    keepPastLessons?: boolean;
  } = {}
): Promise<{ success: boolean; error?: string; deletedCount: number }> {
  const { deletePayments = false, keepPastLessons = true } = options;
  
  try {
    const batch = writeBatch(db);
    let deletedCount = 0;

    // 1. Delete member document
    const memberRef = doc(db, 'members', memberId);
    batch.delete(memberRef);
    deletedCount++;

    // 2. Delete all assigned_packages for this member
    const apQuery = query(
      collection(db, 'assigned_packages'),
      where('memberId', '==', memberId)
    );
    const apSnapshot = await getDocs(apQuery);
    apSnapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      deletedCount++;
    });

    // 3. Remove member from lessons
    const now = Timestamp.now();
    const lessonsQuery = memberUid
      ? query(
          collection(db, 'lessons'),
          where('memberUids', 'array-contains', memberUid)
        )
      : query(
          collection(db, 'lessons'),
          where('memberIds', 'array-contains', memberId)
        );

    const lessonsSnapshot = await getDocs(lessonsQuery);
    
    lessonsSnapshot.forEach((lessonDoc) => {
      const lessonData = lessonDoc.data();
      const lessonDate = lessonData.date as Timestamp;

      // Only modify future lessons if keepPastLessons is true
      if (keepPastLessons && lessonDate.toMillis() < now.toMillis()) {
        return; // Skip past lessons
      }

      // Remove member from all relevant arrays
      const updates: any = {
        memberIds: arrayRemove(memberId),
      };

      if (memberUid) {
        updates.memberUids = arrayRemove(memberUid);
        updates.absentMemberUids = arrayRemove(memberUid);
        updates.walkInMemberUids = arrayRemove(memberUid);
        updates.attendedMemberUids = arrayRemove(memberUid);
      }

      updates.absentMemberIds = arrayRemove(memberId);
      updates.walkInMemberIds = arrayRemove(memberId);
      updates.attendedMemberIds = arrayRemove(memberId);

      batch.update(lessonDoc.ref, updates);
    });

    // 4. Optionally delete payment records
    if (deletePayments) {
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('memberId', '==', memberId)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach((paymentDoc) => {
        batch.delete(paymentDoc.ref);
        deletedCount++;
      });
    }

    // Commit all changes
    await batch.commit();

    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error in deleteMemberWithCascade:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      deletedCount: 0
    };
  }
}

/**
 * Check if a member can be safely deleted
 * Returns warnings about what will be affected
 */
export async function checkMemberDeletionImpact(
  memberId: string,
  memberUid?: string
): Promise<{
  canDelete: boolean;
  warnings: string[];
  counts: {
    assignedPackages: number;
    futureLessons: number;
    pastLessons: number;
    payments: number;
  };
}> {
  try {
    const warnings: string[] = [];
    const counts = {
      assignedPackages: 0,
      futureLessons: 0,
      pastLessons: 0,
      payments: 0,
    };

    // Check assigned packages
    const apQuery = query(
      collection(db, 'assigned_packages'),
      where('memberId', '==', memberId)
    );
    const apSnapshot = await getDocs(apQuery);
    counts.assignedPackages = apSnapshot.size;
    
    if (counts.assignedPackages > 0) {
      warnings.push(`${counts.assignedPackages} adet atanmış paket silinecek.`);
    }

    // Check lessons
    const now = Timestamp.now();
    const lessonsQuery = memberUid
      ? query(
          collection(db, 'lessons'),
          where('memberUids', 'array-contains', memberUid)
        )
      : query(
          collection(db, 'lessons'),
          where('memberIds', 'array-contains', memberId)
        );

    const lessonsSnapshot = await getDocs(lessonsQuery);
    
    lessonsSnapshot.forEach((lessonDoc) => {
      const lessonData = lessonDoc.data();
      const lessonDate = lessonData.date as Timestamp;
      
      if (lessonDate.toMillis() >= now.toMillis()) {
        counts.futureLessons++;
      } else {
        counts.pastLessons++;
      }
    });

    if (counts.futureLessons > 0) {
      warnings.push(`${counts.futureLessons} gelecek dersten çıkarılacak.`);
    }

    if (counts.pastLessons > 0) {
      warnings.push(`${counts.pastLessons} geçmiş ders kaydı korunacak (tarihsel veri).`);
    }

    // Check payments
    try {
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('memberId', '==', memberId)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      counts.payments = paymentsSnapshot.size;
      
      if (counts.payments > 0) {
        warnings.push(`${counts.payments} ödeme kaydı var (silinmeyecek, arşivlenecek).`);
      }
    } catch (e) {
      // Payments collection might not exist yet
      console.warn('Payments collection check failed:', e);
    }

    return {
      canDelete: true,
      warnings,
      counts,
    };
  } catch (error) {
    console.error('Error checking member deletion impact:', error);
    return {
      canDelete: false,
      warnings: ['Silme etkisi kontrol edilirken hata oluştu.'],
      counts: {
        assignedPackages: 0,
        futureLessons: 0,
        pastLessons: 0,
        payments: 0,
      },
    };
  }
}
