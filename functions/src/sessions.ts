import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

function isoDateOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeAt(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Same rule the client's `computeFreeSlots` shows the member — re-derived
 *  here because a client-side "this slot looked free" is UX, not a
 *  guarantee; this is the actual gate. */
function isWithinAvailability(
  availability: FirebaseFirestore.DocumentData,
  slot: Date,
): boolean {
  const exception = (availability.exceptions ?? []).find((e: { date: string }) => e.date === isoDateOf(slot));
  if (exception?.closed) return false;
  const windows: { start: string; end: string }[] = exception?.windows ?? availability.weekly?.[weekdayOf(slot)] ?? [];
  return windows.some((w) => slot.getTime() >= timeAt(slot, w.start).getTime() && slot.getTime() < timeAt(slot, w.end).getTime());
}

/**
 * GymEntra (PKG-8): a member spends their own ders credit on a specific
 * trainer/time. Has to be a callable rather than a client transaction (the
 * pattern `assignPackageToMember`/promotion redemption use) because it
 * needs to *query* the member's credits and sum across however many rows
 * are active, then decide which ones absorb the booking — Firestore rules
 * can guard one document's before/after, not "does this set of documents
 * add up to enough." Same reasoning as every other "sayan her şey
 * callable'da" case in this schema.
 */
export const bookPtSessions = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

    const { tenantId, trainerId, slots: slotStrings } = request.data as {
      tenantId?: string;
      trainerId?: string;
      slots?: string[];
    };
    if (!tenantId || !trainerId || !slotStrings?.length) {
      throw new HttpsError('invalid-argument', 'Eksik bilgi.');
    }
    const slots = slotStrings.map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
    if (slots.some((s) => s.getTime() <= Date.now())) {
      throw new HttpsError('invalid-argument', 'Geçmiş bir saat seçilemez.');
    }

    const db = admin.firestore();
    const membershipRef = db.doc(`tenant_memberships/${tenantId}_${uid}`);
    const trainerMembershipRef = db.doc(`tenant_memberships/${tenantId}_${trainerId}`);
    const availabilityRef = db.doc(`trainer_availability/${tenantId}_${trainerId}`);

    const result = await db.runTransaction(async (tx) => {
      const [membershipSnap, trainerMembershipSnap, availabilitySnap] = await Promise.all([
        tx.get(membershipRef),
        tx.get(trainerMembershipRef),
        tx.get(availabilityRef),
      ]);
      if (!membershipSnap.exists || membershipSnap.data()!.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Bu salonda aktif üyeliğin yok.');
      }
      if (!availabilitySnap.exists) {
        throw new HttpsError('failed-precondition', 'Bu antrenör çalışma saatlerini henüz tanımlamamış.');
      }
      const availability = availabilitySnap.data()!;
      for (const slot of slots) {
        if (!isWithinAvailability(availability, slot)) {
          throw new HttpsError('failed-precondition', `${slot.toLocaleString('tr-TR')} antrenörün çalışma saatleri dışında.`);
        }
      }

      const dayStart = new Date(slots[0]);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(slots[slots.length - 1]);
      dayEnd.setDate(dayEnd.getDate() + 1);
      dayEnd.setHours(0, 0, 0, 0);
      const existingSnap = await tx.get(
        db
          .collection('pt_sessions')
          .where('tenantId', '==', tenantId)
          .where('trainerId', '==', trainerId)
          .where('date', '>=', admin.firestore.Timestamp.fromDate(dayStart))
          .where('date', '<', admin.firestore.Timestamp.fromDate(dayEnd)),
      );
      const taken = new Set(
        existingSnap.docs.filter((d) => d.data().status !== 'cancelled').map((d) => (d.data().date as FirebaseFirestore.Timestamp).toMillis()),
      );
      for (const slot of slots) {
        if (taken.has(slot.getTime())) {
          throw new HttpsError('failed-precondition', `${slot.toLocaleString('tr-TR')} az önce doldu, başka bir saat seç.`);
        }
      }

      const creditsSnap = await tx.get(
        db
          .collection('member_credits')
          .where('tenantId', '==', tenantId)
          .where('memberId', '==', uid)
          .where('kind', '==', 'ptLesson')
          .where('status', '==', 'active')
          .orderBy('expiresAt', 'asc'),
      );
      const credits = creditsSnap.docs.map((d) => ({ ref: d.ref, total: d.data().total as number, used: d.data().used as number }));
      const totalRemaining = credits.reduce((sum, c) => sum + (c.total - c.used), 0);
      if (totalRemaining < slots.length) {
        throw new HttpsError('failed-precondition', `Yeterli ders kredin yok — ${totalRemaining} kaldı, ${slots.length} gerekiyor.`);
      }

      // Spend earliest-expiring credits first, same order the member sees them in.
      const creditIdBySlot: string[] = [];
      let creditIndex = 0;
      let remainingInCurrent = credits[0].total - credits[0].used;
      for (let i = 0; i < slots.length; i++) {
        while (remainingInCurrent <= 0) {
          creditIndex++;
          remainingInCurrent = credits[creditIndex].total - credits[creditIndex].used;
        }
        creditIdBySlot.push(credits[creditIndex].ref.id);
        remainingInCurrent--;
      }

      const trainerName = trainerMembershipSnap.data()?.userDisplayName ?? trainerMembershipSnap.data()?.userEmail ?? 'Antrenör';
      const memberName = membershipSnap.data()?.userDisplayName ?? membershipSnap.data()?.userEmail ?? 'Üye';
      const now = admin.firestore.Timestamp.now();

      slots.forEach((slot, i) => {
        tx.set(db.collection('pt_sessions').doc(), {
          tenantId,
          trainerId,
          trainerName,
          memberId: uid,
          memberName,
          date: admin.firestore.Timestamp.fromDate(slot),
          durationMinutes: availability.slotMinutes ?? 60,
          status: 'scheduled',
          creditId: creditIdBySlot[i],
          createdAt: now,
          updatedAt: now,
        });
      });

      const spendPerCredit = new Map<string, number>();
      for (const id of creditIdBySlot) spendPerCredit.set(id, (spendPerCredit.get(id) ?? 0) + 1);
      for (const credit of credits) {
        const spent = spendPerCredit.get(credit.ref.id);
        if (!spent) continue;
        const newUsed = credit.used + spent;
        tx.update(credit.ref, { used: newUsed, ...(newUsed >= credit.total ? { status: 'exhausted' } : {}) });
      }

      return { booked: slots.length };
    });

    console.log(`Member ${uid} booked ${result.booked} session(s) with trainer ${trainerId}`);
    return result;
  },
);
