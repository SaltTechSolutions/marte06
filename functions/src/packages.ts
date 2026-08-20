import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

import { sendPushToUser } from './push';

/**
 * GymEntra (PKG-2, plan-eng-review Faz 1.2+1.3): expires every past-due
 * credit and, for entitlement-sourced ones, rolls them into their next
 * period — in one job, one transaction per credit.
 *
 * Two bugs this replaces:
 * 1. The old `renewEntitlementCredits` queried `status == 'active'` only,
 *    so a credit a member had just spent down to `exhausted` (e.g. by
 *    booking their last PT session) silently stopped renewing forever —
 *    the member who used the product lost the right; the member who never
 *    touched it kept renewing. Querying `status in ['active','exhausted']`
 *    fixes this.
 * 2. The old job expired the source credit and `add()`ed its successor as
 *    two separate awaited writes — a crash between them silently deleted
 *    the member's entitlement (old marked expired, new never created).
 *    Here both happen in one `runTransaction`, and the successor's id is
 *    deterministic (`${creditId}_next`) so a retried/redelivered run
 *    overwrites the same document instead of minting a second one.
 *
 * Runs daily rather than exactly at each credit's `expiresAt` — a day of
 * slop is fine here (screens compare `expiresAt` against "now" themselves,
 * per AGENTS.md's read-time-check discipline, so a credit already reads as
 * expired before this catches up) and daily keeps the read volume small
 * regardless of how many gyms are on the platform.
 *
 * Only `source === 'entitlement'` credits roll forward — a purchased
 * lesson bundle (`source === 'purchase'`) is a one-time buy and just
 * expires, same as today.
 */
export const creditRollover = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const dueSnap = await db
      .collection('member_credits')
      .where('status', 'in', ['active', 'exhausted'])
      .where('expiresAt', '<=', now)
      .get();

    if (dueSnap.empty) return;

    let expired = 0;
    let renewed = 0;
    let skipped = 0;
    for (const creditDoc of dueSnap.docs) {
      const credit = creditDoc.data();
      const successorRef = db.collection('member_credits').doc(`${creditDoc.id}_next`);

      // The transaction returns its outcome rather than incrementing the
      // counters itself — Firestore retries this callback on contention,
      // and mutating closure state inside a retried callback would
      // double-count on every retry.
      const outcome = await db.runTransaction(async (tx) => {
        // Every read this transaction needs, before any write — Firestore
        // requires reads first.
        const assignmentSnap = credit.source === 'entitlement' ? await tx.get(db.doc(`member_packages/${credit.sourcePackageId}`)) : null;

        tx.update(creditDoc.ref, { status: 'expired' });

        if (credit.source !== 'entitlement') return 'skipped' as const;

        const assignment = assignmentSnap?.data();
        if (!assignment || assignment.status !== 'active' || assignment.endsAt.toMillis() <= now.toMillis()) return 'skipped' as const;

        const entitlement = credit.kind === 'ptLesson' ? assignment.entitlements?.ptLessons : assignment.entitlements?.groupClasses;
        if (!entitlement?.count || !entitlement?.periodDays) {
          // The catalog content changed underneath an old assignment
          // (shouldn't happen — gym_packages locks while assigned — but an
          // assignment outlives that lock if the package was retired
          // mid-term). Stop quietly rather than crash the whole batch over
          // one holder.
          return 'skipped' as const;
        }

        const nextExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + entitlement.periodDays * 86400000);
        tx.set(successorRef, {
          tenantId: credit.tenantId,
          memberId: credit.memberId,
          kind: credit.kind,
          source: 'entitlement',
          sourcePackageId: credit.sourcePackageId,
          total: entitlement.count,
          used: 0,
          startsAt: now,
          expiresAt: nextExpiresAt,
          status: 'active',
        });
        return 'renewed' as const;
      });

      expired += 1;
      if (outcome === 'renewed') renewed += 1;
      else skipped += 1;
    }

    console.log(`Credit rollover: ${expired} expired, ${renewed} renewed, ${skipped} skipped (${dueSnap.size} due)`);
  },
);

function addDaysMs(date: FirebaseFirestore.Timestamp, days: number): FirebaseFirestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(date.toMillis() + days * 86400000);
}

/**
 * GymEntra (PKG-6): the only thing that ever touches `member_packages` for a
 * *change* to an already-holding member — approving a `package_change_requests`
 * doc is a plain field flip a member can do themselves (see the rule), but
 * everything downstream of that (cancelling the old holding, creating the
 * new one, moving credits, redeeming a promotion, recording a refund) needs
 * trust `member_packages`' own rule refuses to grant to any client, admin
 * included. This is the one place that trust exists.
 *
 * Re-validates the target package and promotion at apply time rather than
 * trusting the request's snapshot — days can pass between an admin proposing
 * a swap and a member approving it, long enough for a promotion to run out.
 * A promotion that's no longer valid is silently dropped (the member still
 * gets the swap they approved, just without a bonus that expired under
 * them) rather than failing the whole approval over it.
 *
 * Idempotent via `appliedAt` on the request: Cloud Functions triggers can
 * redeliver the same event, and this must never double-cancel, double-mint
 * credits, or double-redeem a promotion.
 */
export const applyPackageChange = onDocumentUpdated(
  { document: 'package_change_requests/{requestId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after || before.status === after.status) return;

    if (after.status === 'rejected') {
      await sendPushToUser(
        after.createdBy,
        'Paket teklifi reddedildi',
        `${after.memberName}, ${after.proposedSummary?.packageName ?? 'önerilen paketi'} kabul etmedi.`,
      );
      return;
    }
    if (after.status !== 'approved' || after.appliedAt) return;

    const db = admin.firestore();
    const requestRef = event.data!.after.ref;

    await db.runTransaction(async (tx) => {
      const proposedPkgRef = db.doc(`gym_packages/${after.proposedPackageId}`);
      const proposedPkgSnap = await tx.get(proposedPkgRef);
      if (!proposedPkgSnap.exists) throw new Error(`Proposed package ${after.proposedPackageId} no longer exists`);
      const proposedPkg = proposedPkgSnap.data()!;

      let currentSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (after.currentPackageAssignmentId) {
        currentSnap = await tx.get(db.doc(`member_packages/${after.currentPackageAssignmentId}`));
      }

      let promotion: FirebaseFirestore.DocumentData | null = null;
      let promotionRef: FirebaseFirestore.DocumentReference | null = null;
      if (after.proposedPromotionId) {
        promotionRef = db.doc(`promotions/${after.proposedPromotionId}`);
        const promoSnap = await tx.get(promotionRef);
        const now = admin.firestore.Timestamp.now();
        if (
          promoSnap.exists &&
          promoSnap.data()!.isActive &&
          promoSnap.data()!.startsAt.toMillis() <= now.toMillis() &&
          promoSnap.data()!.endsAt.toMillis() >= now.toMillis() &&
          (promoSnap.data()!.maxRedemptions == null || (promoSnap.data()!.redeemed ?? 0) < promoSnap.data()!.maxRedemptions)
        ) {
          promotion = promoSnap.data()!;
        } else {
          promotion = null; // expired/exhausted/deactivated since the offer was made — drop it, don't fail the swap
        }
      }

      const effectiveAt = after.effectiveAt as FirebaseFirestore.Timestamp;
      const bonusDays = promotion?.kind === 'bonusDays' ? promotion.value : 0;
      const bonusLessons = promotion?.kind === 'bonusLessons' ? promotion.value : 0;
      const finalPrice =
        promotion?.kind === 'percentDiscount'
          ? Math.max(0, Math.round(proposedPkg.price * (1 - promotion.value / 100)))
          : promotion?.kind === 'amountDiscount'
            ? Math.max(0, proposedPkg.price - promotion.value)
            : proposedPkg.price;
      const endsAt =
        proposedPkg.kind === 'membership'
          ? addDaysMs(effectiveAt, (proposedPkg.durationDays ?? 0) + bonusDays)
          : addDaysMs(effectiveAt, proposedPkg.lessonValidityDays ?? 0);

      // Cancel the holding being replaced, if it's still active — a pure
      // addition (no currentPackageAssignmentId) leaves nothing to cancel.
      if (currentSnap?.exists && currentSnap.data()!.status === 'active') {
        tx.update(currentSnap.ref, { status: 'cancelled' });
      }

      const newPackageRef = db.collection('member_packages').doc();
      tx.set(newPackageRef, {
        tenantId: after.tenantId,
        memberId: after.memberId,
        memberName: after.memberName,
        packageId: after.proposedPackageId,
        packageName: proposedPkg.name,
        kind: proposedPkg.kind,
        entitlements: proposedPkg.entitlements,
        ...(proposedPkg.freezePolicy ? { freezePolicy: proposedPkg.freezePolicy } : {}),
        listPrice: proposedPkg.price,
        finalPrice,
        ...(promotion ? { promotionId: after.proposedPromotionId, promotionName: promotion.name, bonusDays, bonusLessons } : {}),
        startsAt: effectiveAt,
        endsAt,
        frozenDays: 0,
        freezes: [],
        status: 'active',
        assignedAt: admin.firestore.Timestamp.now(),
        assignedBy: after.createdBy,
      });

      const addCredit = (kind: 'ptLesson' | 'groupClass', source: 'purchase' | 'entitlement', total: number, expiresAt: FirebaseFirestore.Timestamp) => {
        tx.set(db.collection('member_credits').doc(), {
          tenantId: after.tenantId,
          memberId: after.memberId,
          kind,
          source,
          sourcePackageId: newPackageRef.id,
          total,
          used: 0,
          startsAt: effectiveAt,
          expiresAt,
          status: 'active',
        });
      };
      if (proposedPkg.kind === 'lessons' && proposedPkg.lessonCount) {
        addCredit('ptLesson', 'purchase', proposedPkg.lessonCount + bonusLessons, endsAt);
      }
      if (proposedPkg.kind === 'membership') {
        const gc = proposedPkg.entitlements?.groupClasses;
        if (gc && !gc.unlimited && gc.count && gc.periodDays) {
          addCredit('groupClass', 'entitlement', gc.count, addDaysMs(effectiveAt, gc.periodDays));
        }
        const pt = proposedPkg.entitlements?.ptLessons;
        if (pt?.count && pt.periodDays) {
          addCredit('ptLesson', 'entitlement', pt.count, addDaysMs(effectiveAt, pt.periodDays));
        }
      }

      if (promotion && promotionRef) {
        tx.update(promotionRef, { redeemed: (promotion.redeemed ?? 0) + 1 });
      }

      // Refund uses the amount shown to the member at approval time, not a
      // number recomputed now — they approved a specific figure.
      if (after.refundAmount) {
        tx.set(db.collection('payments').doc(), {
          tenantId: after.tenantId,
          memberId: after.memberId,
          memberName: after.memberName,
          amount: after.refundAmount,
          method: 'cash',
          status: 'confirmed',
          kind: 'refund',
          note: `${after.currentSummary?.packageName ?? 'eski paket'} → ${proposedPkg.name} geçişi (${after.refundBasis ?? ''})`,
          createdAt: admin.firestore.Timestamp.now(),
          confirmedAt: admin.firestore.Timestamp.now(),
        });
      }

      tx.update(requestRef, { appliedAt: admin.firestore.Timestamp.now() });
    });

    console.log(`Package change ${event.params.requestId} applied for member ${after.memberId}`);
  },
);

/**
 * GymEntra (PKG-6): a proposal nobody answered doesn't stay pending forever
 * — an admin who forgot about it shouldn't find a stale offer months later.
 */
export const expirePendingPackageChangeRequests = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const dueSnap = await db
      .collection('package_change_requests')
      .where('status', '==', 'pending')
      .where('expiresAt', '<=', now)
      .get();
    if (dueSnap.empty) return;

    const batch = db.batch();
    dueSnap.docs.forEach((doc) => batch.update(doc.ref, { status: 'expired' }));
    await batch.commit();
    console.log(`${dueSnap.size} package change request(s) expired`);
  },
);
