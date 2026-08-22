import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
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
 * GymEntra (PKG-6, plan-eng-review Faz 1.6): the only thing that ever
 * touches `member_packages` for a *change* to an already-holding member.
 * Everything downstream of a member's decision (cancelling the old
 * holding, creating the new one, moving credits, redeeming a promotion,
 * recording a refund) needs trust `member_packages`' own rule refuses to
 * grant to any client, admin included. This is the one place that trust
 * exists — the rule now closes the member's `status` field entirely (see
 * `firestore.rules`), so this callable is the *only* way a
 * `package_change_requests` doc moves out of `pending`, approve or reject.
 *
 * Was a `package_change_requests` `onDocumentUpdated` trigger. Rewritten as
 * a callable for a concrete failure this had: the trigger ran *after* the
 * member's own `status: 'approved'` write already succeeded, so a member
 * saw "Teklifi onayladın" the instant their write landed — before the swap
 * (or its failure) was known. If the trigger then threw or never ran, the
 * request sat "approved" forever with nothing actually applied. Here the
 * member's approval and the swap are the same transaction; success is
 * only ever reported once the package genuinely changed.
 *
 * Fixes folded in from this review's outside-voice pass (Codex #6–#10, #14):
 * - #7 tenant boundary — every referenced doc (package, promotion, the
 *   assignment being replaced) is checked against the request's own
 *   `tenantId`, not assumed.
 * - #8/#14 double-approval — if `currentPackageAssignmentId` is set, it
 *   must still read `status == 'active'` inside this transaction. A second
 *   request racing (or a stale retry) that targets an assignment some
 *   other approval already cancelled fails loudly instead of minting a
 *   second active package on top of it.
 * - #9 stranded credits — the assignment being replaced has its own
 *   `member_credits` cancelled here, not left `active` alongside the new
 *   package's fresh credits (which used to let a member spend both).
 * - #10 promotion expiring between offer and approval: the OLD behavior
 *   silently dropped the bonus and applied the swap at full price — a
 *   member who approved 500₺ could be charged 750₺ without ever agreeing
 *   to it. Now: if the offer named a promotion and it's no longer valid,
 *   the WHOLE approval is refused, the request is marked `expired`, and
 *   the admin is asked to re-propose with a current price.
 *
 * Idempotent by construction: approving reads the request's own `status`
 * inside the transaction and requires `pending`, so a redelivered/retried
 * client call (or a second concurrent tap) reads `approved` on retry and is
 * rejected before it can touch anything else.
 */
export const approvePackageChange = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

    const { requestId, approve } = request.data as { requestId?: string; approve?: boolean };
    if (!requestId || typeof approve !== 'boolean') throw new HttpsError('invalid-argument', 'Eksik bilgi.');

    const db = admin.firestore();
    const requestRef = db.doc(`package_change_requests/${requestId}`);

    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) throw new HttpsError('not-found', 'Teklif bulunamadı.');
      const req = reqSnap.data()!;
      if (req.memberId !== uid) throw new HttpsError('permission-denied', 'Bu teklif sana ait değil.');
      if (req.status !== 'pending') throw new HttpsError('failed-precondition', 'Bu teklif zaten yanıtlandı.');

      const now = admin.firestore.Timestamp.now();

      if (!approve) {
        tx.update(requestRef, { status: 'rejected', respondedAt: now });
        return { status: 'rejected' as const };
      }

      const proposedPkgSnap = await tx.get(db.doc(`gym_packages/${req.proposedPackageId}`));
      if (!proposedPkgSnap.exists || proposedPkgSnap.data()!.tenantId !== req.tenantId) {
        throw new HttpsError('failed-precondition', 'Önerilen paket artık mevcut değil.');
      }
      const proposedPkg = proposedPkgSnap.data()!;

      let currentSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (req.currentPackageAssignmentId) {
        currentSnap = await tx.get(db.doc(`member_packages/${req.currentPackageAssignmentId}`));
        const current = currentSnap.data();
        if (!currentSnap.exists || current!.tenantId !== req.tenantId || current!.memberId !== req.memberId) {
          throw new HttpsError('failed-precondition', 'Değiştirilecek paket bu üyeye veya salona ait değil.');
        }
        if (current!.status !== 'active') {
          // Another approval already replaced this holding (Codex #8) —
          // approving this stale request on top of it would mint a second
          // active package instead of failing.
          throw new HttpsError('failed-precondition', 'Bu paket zaten değiştirilmiş — teklif artık geçersiz.');
        }
      }

      // Credits tied to the holding being replaced must not survive
      // alongside the new package's fresh ones (Codex #9) — collected now,
      // cancelled together with everything else below.
      const oldCreditsSnap = req.currentPackageAssignmentId
        ? await tx.get(db.collection('member_credits').where('sourcePackageId', '==', req.currentPackageAssignmentId).where('status', 'in', ['active', 'exhausted']))
        : null;

      let promotion: FirebaseFirestore.DocumentData | null = null;
      let promotionRef: FirebaseFirestore.DocumentReference | null = null;
      if (req.proposedPromotionId) {
        promotionRef = db.doc(`promotions/${req.proposedPromotionId}`);
        const promoSnap = await tx.get(promotionRef);
        const promo = promoSnap.data();
        const valid =
          promoSnap.exists &&
          promo!.tenantId === req.tenantId &&
          promo!.isActive &&
          promo!.startsAt.toMillis() <= now.toMillis() &&
          promo!.endsAt.toMillis() >= now.toMillis() &&
          (promo!.maxRedemptions == null || (promo!.redeemed ?? 0) < promo!.maxRedemptions);

        if (!valid) {
          // Codex #10: the promotion the member approved is gone — refuse
          // the whole swap rather than silently charging full price for
          // something they agreed to at a discount.
          tx.update(requestRef, { status: 'expired', respondedAt: now });
          return { status: 'promotion-expired' as const };
        }
        promotion = promo!;
      }

      const effectiveAt = req.effectiveAt as FirebaseFirestore.Timestamp;
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

      if (currentSnap?.exists) {
        tx.update(currentSnap.ref, { status: 'cancelled' });
      }
      oldCreditsSnap?.docs.forEach((creditDoc) => tx.update(creditDoc.ref, { status: 'cancelled' }));

      const newPackageRef = db.collection('member_packages').doc();
      tx.set(newPackageRef, {
        tenantId: req.tenantId,
        memberId: req.memberId,
        memberName: req.memberName,
        packageId: req.proposedPackageId,
        packageName: proposedPkg.name,
        kind: proposedPkg.kind,
        entitlements: proposedPkg.entitlements,
        ...(proposedPkg.freezePolicy ? { freezePolicy: proposedPkg.freezePolicy } : {}),
        listPrice: proposedPkg.price,
        finalPrice,
        ...(promotion ? { promotionId: req.proposedPromotionId, promotionName: promotion.name, bonusDays, bonusLessons } : {}),
        startsAt: effectiveAt,
        endsAt,
        frozenDays: 0,
        freezes: [],
        status: 'active',
        assignedAt: now,
        assignedBy: req.createdBy,
      });

      const addCredit = (kind: 'ptLesson' | 'groupClass', source: 'purchase' | 'entitlement', total: number, expiresAt: FirebaseFirestore.Timestamp) => {
        tx.set(db.collection('member_credits').doc(), {
          tenantId: req.tenantId,
          memberId: req.memberId,
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
      if (req.refundAmount) {
        tx.set(db.collection('payments').doc(), {
          tenantId: req.tenantId,
          memberId: req.memberId,
          memberName: req.memberName,
          amount: req.refundAmount,
          method: 'cash',
          status: 'confirmed',
          kind: 'refund',
          note: `${req.currentSummary?.packageName ?? 'eski paket'} → ${proposedPkg.name} geçişi (${req.refundBasis ?? ''})`,
          createdAt: now,
          confirmedAt: now,
        });
      }

      tx.update(requestRef, { status: 'approved', respondedAt: now, appliedAt: now });
      return { status: 'approved' as const, packageId: newPackageRef.id };
    });

    if (result.status === 'rejected') {
      const req = (await requestRef.get()).data()!;
      await sendPushToUser(
        req.createdBy,
        'Paket teklifi reddedildi',
        `${req.memberName}, ${req.proposedSummary?.packageName ?? 'önerilen paketi'} kabul etmedi.`,
      );
    } else if (result.status === 'promotion-expired') {
      const req = (await requestRef.get()).data()!;
      await sendPushToUser(
        req.createdBy,
        'Promosyon süresi doldu',
        `${req.memberName} teklifi onaylamak istedi ama bağlı promosyonun süresi bu arada doldu. Teklifi güncel fiyatla yenile.`,
      );
    }

    console.log(`Package change ${requestId}: ${result.status}`);
    return result;
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
