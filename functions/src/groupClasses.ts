import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const db = () => admin.firestore();

/**
 * Books a member into a group class, spending a quota credit (PER-9 / PKG-4).
 *
 * PKG-4 deliberately shipped only the `{unlimited: true}` half: a quota'd
 * allowance needs something that can decrement a credit and add the uid in one
 * atomic step, and rules cannot do arithmetic. So a gym could SELL "ayda 8
 * grup dersi" and the member holding it saw a locked button reading "yakında
 * aktif olacak". This is that missing half.
 *
 * Unlimited entitlements keep their existing direct client write. Two paths
 * for one action is not ideal, but that path is in production and works, and
 * routing it through here unverified would risk a working flow to tidy up a
 * seam. Consolidating belongs with PKG-11, when cancellation moves server-side
 * too — noted in plan.md.
 *
 * A full class puts the member on the waitlist and spends NOTHING: they have
 * no place yet, and charging for a maybe is how a quota quietly evaporates.
 */
export const bookGroupClass = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

  const classId = String(request.data?.classId ?? '').trim();
  const memberId = String(request.data?.memberId ?? uid).trim();
  if (!classId) throw new HttpsError('invalid-argument', 'Ders bilgisi eksik.');

  const classRef = db().doc(`classes/${classId}`);

  const result = await db().runTransaction(async (tx) => {
    const classSnap = await tx.get(classRef);
    if (!classSnap.exists) throw new HttpsError('not-found', 'Ders bulunamadı.');
    const klass = classSnap.data()!;
    const tenantId = klass.tenantId as string;

    // Acting for someone else is only ever a guardian acting for their child
    // (MEMBER-5c) — the same authority PT booking recognises.
    if (memberId !== uid) {
      const childSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${memberId}`));
      const child = childSnap.data();
      if (!childSnap.exists || child!.guardianId !== uid || child!.guardianStatus !== 'approved') {
        throw new HttpsError('permission-denied', 'Bu üye adına işlem yapamazsın.');
      }
    }

    const membershipSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${memberId}`));
    if (!membershipSnap.exists || membershipSnap.data()!.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Bu salonda aktif üyeliğin yok.');
    }

    const booked: string[] = klass.bookedUserIds ?? [];
    const waitlist: string[] = klass.waitlistUserIds ?? [];
    if (booked.includes(memberId)) return { status: 'already-booked' as const };
    if (waitlist.includes(memberId)) return { status: 'already-waitlisted' as const };

    const now = admin.firestore.Timestamp.now();
    const classDate = klass.date as FirebaseFirestore.Timestamp;
    if (classDate.toMillis() < Date.now()) {
      throw new HttpsError('failed-precondition', 'Geçmiş bir derse kayıt olunamaz.');
    }

    // Full: waitlist, and spend nothing.
    if (booked.length >= (klass.capacity as number)) {
      tx.update(classRef, { waitlistUserIds: admin.firestore.FieldValue.arrayUnion(memberId) });
      return { status: 'waitlisted' as const };
    }

    const cacheSnap = await tx.get(db().doc(`member_entitlements/${tenantId}_${memberId}`));
    const cache = cacheSnap.data();
    const endsAt = cache?.endsAt as FirebaseFirestore.Timestamp | undefined;
    if (!cache || !endsAt || endsAt.toMillis() < Date.now()) {
      throw new HttpsError('failed-precondition', 'Aktif bir paketin yok.');
    }
    const groupClasses = cache.entitlements?.groupClasses;
    if (!groupClasses) {
      throw new HttpsError('failed-precondition', 'Paketin grup dersi içermiyor.');
    }

    // Unlimited never reaches here from the app, but a direct call must still
    // behave: no credit to spend, just take the place.
    if (groupClasses.unlimited === true) {
      tx.update(classRef, { bookedUserIds: admin.firestore.FieldValue.arrayUnion(memberId) });
      return { status: 'booked' as const };
    }

    // Same discipline as PT: earliest-expiring first, and a credit can only
    // pay for a class that falls before it expires — a credit good for three
    // more days must not buy a place three months out.
    const creditsSnap = await tx.get(
      db()
        .collection('member_credits')
        .where('tenantId', '==', tenantId)
        .where('memberId', '==', memberId)
        .where('kind', '==', 'groupClass')
        .where('status', '==', 'active')
        .where('expiresAt', '>', now)
        .orderBy('expiresAt', 'asc'),
    );
    const credit = creditsSnap.docs.find((d) => {
      const c = d.data();
      return c.total - c.used > 0 && (c.expiresAt as FirebaseFirestore.Timestamp).toMillis() >= classDate.toMillis();
    });
    if (!credit) {
      throw new HttpsError('failed-precondition', 'Bu ders için geçerli grup dersi hakkın kalmadı.');
    }

    const c = credit.data();
    const newUsed = (c.used as number) + 1;
    tx.update(credit.ref, { used: newUsed, ...(newUsed >= (c.total as number) ? { status: 'exhausted' } : {}) });
    tx.update(classRef, {
      bookedUserIds: admin.firestore.FieldValue.arrayUnion(memberId),
      // Which credit paid for this place, so cancelling can put back the same
      // one rather than guessing at the member's current balance.
      [`bookingCredits.${memberId}`]: credit.ref.id,
    });
    return { status: 'booked' as const, creditId: credit.ref.id };
  });

  console.log(`Group class ${classId}: ${memberId} -> ${result.status} (by ${uid})`);
  return result;
});

/**
 * Cancels a group-class booking and decides whether the credit comes back
 * (PER-9 + PKG-11).
 *
 * Mirrors `cancelPtSession` exactly, including the gym's own
 * `cancellationHours`: a member who cancels in time gets the credit back, a
 * late one does not, and staff cancelling always refunds because the member
 * did not cause it.
 */
export const cancelGroupClassBooking = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

  const classId = String(request.data?.classId ?? '').trim();
  const memberId = String(request.data?.memberId ?? uid).trim();
  if (!classId) throw new HttpsError('invalid-argument', 'Ders bilgisi eksik.');

  const classRef = db().doc(`classes/${classId}`);

  const result = await db().runTransaction(async (tx) => {
    const classSnap = await tx.get(classRef);
    if (!classSnap.exists) throw new HttpsError('not-found', 'Ders bulunamadı.');
    const klass = classSnap.data()!;
    const tenantId = klass.tenantId as string;

    const callerSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${uid}`));
    const caller = callerSnap.data();
    const roles: string[] = caller?.roles ?? [];
    const isStaff = callerSnap.exists && caller!.status === 'active' && (roles.includes('admin') || roles.includes('trainer'));

    if (memberId !== uid && !isStaff) {
      const childSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${memberId}`));
      const child = childSnap.data();
      if (!childSnap.exists || child!.guardianId !== uid || child!.guardianStatus !== 'approved') {
        throw new HttpsError('permission-denied', 'Bu üye adına işlem yapamazsın.');
      }
    }

    const booked: string[] = klass.bookedUserIds ?? [];
    const waitlist: string[] = klass.waitlistUserIds ?? [];

    // Leaving the waitlist costs nothing and refunds nothing — no credit was
    // ever spent to sit on it.
    if (!booked.includes(memberId)) {
      if (!waitlist.includes(memberId)) return { refunded: false, wasBooked: false };
      tx.update(classRef, { waitlistUserIds: admin.firestore.FieldValue.arrayRemove(memberId) });
      return { refunded: false, wasBooked: false };
    }

    const creditId = klass.bookingCredits?.[memberId] as string | undefined;
    let refunded = false;

    if (creditId) {
      const creditRef = db().doc(`member_credits/${creditId}`);
      const creditSnap = await tx.get(creditRef);
      if (creditSnap.exists) {
        let shouldRefund = isStaff;
        if (!shouldRefund) {
          const tenantSnap = await tx.get(db().doc(`tenants/${tenantId}`));
          const cancellationHours = (tenantSnap.data()?.cancellationHours as number | undefined) ?? 24;
          const hoursUntil = ((klass.date as FirebaseFirestore.Timestamp).toMillis() - Date.now()) / 3600000;
          shouldRefund = hoursUntil >= cancellationHours;
        }
        if (shouldRefund) {
          const c = creditSnap.data()!;
          tx.update(creditRef, {
            used: Math.max(0, (c.used as number) - 1),
            ...(c.status === 'exhausted' ? { status: 'active' } : {}),
          });
          refunded = true;
        }
      }
    }

    tx.update(classRef, {
      bookedUserIds: admin.firestore.FieldValue.arrayRemove(memberId),
      [`bookingCredits.${memberId}`]: admin.firestore.FieldValue.delete(),
    });
    return { refunded, wasBooked: true };
  });

  console.log(`Group class ${classId}: ${memberId} cancelled, refunded=${result.refunded} (by ${uid})`);
  return result;
});
