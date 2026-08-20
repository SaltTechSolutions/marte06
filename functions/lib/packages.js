"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.expirePendingPackageChangeRequests = exports.applyPackageChange = exports.creditRollover = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const push_1 = require("./push");
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
exports.creditRollover = (0, scheduler_1.onSchedule)({ schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const dueSnap = await db
        .collection('member_credits')
        .where('status', 'in', ['active', 'exhausted'])
        .where('expiresAt', '<=', now)
        .get();
    if (dueSnap.empty)
        return;
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
            var _a, _b;
            // Every read this transaction needs, before any write — Firestore
            // requires reads first.
            const assignmentSnap = credit.source === 'entitlement' ? await tx.get(db.doc(`member_packages/${credit.sourcePackageId}`)) : null;
            tx.update(creditDoc.ref, { status: 'expired' });
            if (credit.source !== 'entitlement')
                return 'skipped';
            const assignment = assignmentSnap === null || assignmentSnap === void 0 ? void 0 : assignmentSnap.data();
            if (!assignment || assignment.status !== 'active' || assignment.endsAt.toMillis() <= now.toMillis())
                return 'skipped';
            const entitlement = credit.kind === 'ptLesson' ? (_a = assignment.entitlements) === null || _a === void 0 ? void 0 : _a.ptLessons : (_b = assignment.entitlements) === null || _b === void 0 ? void 0 : _b.groupClasses;
            if (!(entitlement === null || entitlement === void 0 ? void 0 : entitlement.count) || !(entitlement === null || entitlement === void 0 ? void 0 : entitlement.periodDays)) {
                // The catalog content changed underneath an old assignment
                // (shouldn't happen — gym_packages locks while assigned — but an
                // assignment outlives that lock if the package was retired
                // mid-term). Stop quietly rather than crash the whole batch over
                // one holder.
                return 'skipped';
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
            return 'renewed';
        });
        expired += 1;
        if (outcome === 'renewed')
            renewed += 1;
        else
            skipped += 1;
    }
    console.log(`Credit rollover: ${expired} expired, ${renewed} renewed, ${skipped} skipped (${dueSnap.size} due)`);
});
function addDaysMs(date, days) {
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
exports.applyPackageChange = (0, firestore_1.onDocumentUpdated)({ document: 'package_change_requests/{requestId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after || before.status === after.status)
        return;
    if (after.status === 'rejected') {
        await (0, push_1.sendPushToUser)(after.createdBy, 'Paket teklifi reddedildi', `${after.memberName}, ${(_f = (_e = after.proposedSummary) === null || _e === void 0 ? void 0 : _e.packageName) !== null && _f !== void 0 ? _f : 'önerilen paketi'} kabul etmedi.`);
        return;
    }
    if (after.status !== 'approved' || after.appliedAt)
        return;
    const db = admin.firestore();
    const requestRef = event.data.after.ref;
    await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const proposedPkgRef = db.doc(`gym_packages/${after.proposedPackageId}`);
        const proposedPkgSnap = await tx.get(proposedPkgRef);
        if (!proposedPkgSnap.exists)
            throw new Error(`Proposed package ${after.proposedPackageId} no longer exists`);
        const proposedPkg = proposedPkgSnap.data();
        let currentSnap = null;
        if (after.currentPackageAssignmentId) {
            currentSnap = await tx.get(db.doc(`member_packages/${after.currentPackageAssignmentId}`));
        }
        let promotion = null;
        let promotionRef = null;
        if (after.proposedPromotionId) {
            promotionRef = db.doc(`promotions/${after.proposedPromotionId}`);
            const promoSnap = await tx.get(promotionRef);
            const now = admin.firestore.Timestamp.now();
            if (promoSnap.exists &&
                promoSnap.data().isActive &&
                promoSnap.data().startsAt.toMillis() <= now.toMillis() &&
                promoSnap.data().endsAt.toMillis() >= now.toMillis() &&
                (promoSnap.data().maxRedemptions == null || ((_a = promoSnap.data().redeemed) !== null && _a !== void 0 ? _a : 0) < promoSnap.data().maxRedemptions)) {
                promotion = promoSnap.data();
            }
            else {
                promotion = null; // expired/exhausted/deactivated since the offer was made — drop it, don't fail the swap
            }
        }
        const effectiveAt = after.effectiveAt;
        const bonusDays = (promotion === null || promotion === void 0 ? void 0 : promotion.kind) === 'bonusDays' ? promotion.value : 0;
        const bonusLessons = (promotion === null || promotion === void 0 ? void 0 : promotion.kind) === 'bonusLessons' ? promotion.value : 0;
        const finalPrice = (promotion === null || promotion === void 0 ? void 0 : promotion.kind) === 'percentDiscount'
            ? Math.max(0, Math.round(proposedPkg.price * (1 - promotion.value / 100)))
            : (promotion === null || promotion === void 0 ? void 0 : promotion.kind) === 'amountDiscount'
                ? Math.max(0, proposedPkg.price - promotion.value)
                : proposedPkg.price;
        const endsAt = proposedPkg.kind === 'membership'
            ? addDaysMs(effectiveAt, ((_b = proposedPkg.durationDays) !== null && _b !== void 0 ? _b : 0) + bonusDays)
            : addDaysMs(effectiveAt, (_c = proposedPkg.lessonValidityDays) !== null && _c !== void 0 ? _c : 0);
        // Cancel the holding being replaced, if it's still active — a pure
        // addition (no currentPackageAssignmentId) leaves nothing to cancel.
        if ((currentSnap === null || currentSnap === void 0 ? void 0 : currentSnap.exists) && currentSnap.data().status === 'active') {
            tx.update(currentSnap.ref, { status: 'cancelled' });
        }
        const newPackageRef = db.collection('member_packages').doc();
        tx.set(newPackageRef, Object.assign(Object.assign(Object.assign(Object.assign({ tenantId: after.tenantId, memberId: after.memberId, memberName: after.memberName, packageId: after.proposedPackageId, packageName: proposedPkg.name, kind: proposedPkg.kind, entitlements: proposedPkg.entitlements }, (proposedPkg.freezePolicy ? { freezePolicy: proposedPkg.freezePolicy } : {})), { listPrice: proposedPkg.price, finalPrice }), (promotion ? { promotionId: after.proposedPromotionId, promotionName: promotion.name, bonusDays, bonusLessons } : {})), { startsAt: effectiveAt, endsAt, frozenDays: 0, freezes: [], status: 'active', assignedAt: admin.firestore.Timestamp.now(), assignedBy: after.createdBy }));
        const addCredit = (kind, source, total, expiresAt) => {
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
            const gc = (_d = proposedPkg.entitlements) === null || _d === void 0 ? void 0 : _d.groupClasses;
            if (gc && !gc.unlimited && gc.count && gc.periodDays) {
                addCredit('groupClass', 'entitlement', gc.count, addDaysMs(effectiveAt, gc.periodDays));
            }
            const pt = (_e = proposedPkg.entitlements) === null || _e === void 0 ? void 0 : _e.ptLessons;
            if ((pt === null || pt === void 0 ? void 0 : pt.count) && pt.periodDays) {
                addCredit('ptLesson', 'entitlement', pt.count, addDaysMs(effectiveAt, pt.periodDays));
            }
        }
        if (promotion && promotionRef) {
            tx.update(promotionRef, { redeemed: ((_f = promotion.redeemed) !== null && _f !== void 0 ? _f : 0) + 1 });
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
                note: `${(_h = (_g = after.currentSummary) === null || _g === void 0 ? void 0 : _g.packageName) !== null && _h !== void 0 ? _h : 'eski paket'} → ${proposedPkg.name} geçişi (${(_j = after.refundBasis) !== null && _j !== void 0 ? _j : ''})`,
                createdAt: admin.firestore.Timestamp.now(),
                confirmedAt: admin.firestore.Timestamp.now(),
            });
        }
        tx.update(requestRef, { appliedAt: admin.firestore.Timestamp.now() });
    });
    console.log(`Package change ${event.params.requestId} applied for member ${after.memberId}`);
});
/**
 * GymEntra (PKG-6): a proposal nobody answered doesn't stay pending forever
 * — an admin who forgot about it shouldn't find a stale offer months later.
 */
exports.expirePendingPackageChangeRequests = (0, scheduler_1.onSchedule)({ schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const dueSnap = await db
        .collection('package_change_requests')
        .where('status', '==', 'pending')
        .where('expiresAt', '<=', now)
        .get();
    if (dueSnap.empty)
        return;
    const batch = db.batch();
    dueSnap.docs.forEach((doc) => batch.update(doc.ref, { status: 'expired' }));
    await batch.commit();
    console.log(`${dueSnap.size} package change request(s) expired`);
});
//# sourceMappingURL=packages.js.map