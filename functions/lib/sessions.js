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
exports.cancelPtSession = exports.bookPtSessions = void 0;
exports.isWithinAvailability = isWithinAvailability;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
function weekdayOf(date) {
    return WEEKDAYS[(date.getDay() + 6) % 7];
}
function isoDateOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function timeAt(base, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
}
/**
 * Same rule the client's `computeFreeSlots` shows the member — re-derived
 * here because a client-side "this slot looked free" is UX, not a
 * guarantee; this is the actual gate.
 *
 * Checks three things a bare "is the start time inside the window" test
 * missed (plan-eng-review Faz 1.7): the slot must fall exactly on a
 * `slotMinutes` boundary from the window's own start (grid alignment —
 * without this, `09:00–12:00` at 60-minute slots would still accept
 * `11:37`), and the slot must *end* before the window closes, not just
 * start inside it (without this, a 60-minute slot at `11:30` in a
 * `09:00–12:00` window passes a start-only check but runs 30 minutes past
 * close).
 */
function isWithinAvailability(availability, slot) {
    var _a, _b, _c, _d, _e;
    const exception = ((_a = availability.exceptions) !== null && _a !== void 0 ? _a : []).find((e) => e.date === isoDateOf(slot));
    if (exception === null || exception === void 0 ? void 0 : exception.closed)
        return false;
    const windows = (_d = (_b = exception === null || exception === void 0 ? void 0 : exception.windows) !== null && _b !== void 0 ? _b : (_c = availability.weekly) === null || _c === void 0 ? void 0 : _c[weekdayOf(slot)]) !== null && _d !== void 0 ? _d : [];
    const slotMinutes = (_e = availability.slotMinutes) !== null && _e !== void 0 ? _e : 60;
    const slotMs = slotMinutes * 60000;
    return windows.some((w) => {
        const windowStart = timeAt(slot, w.start).getTime();
        const windowEnd = timeAt(slot, w.end).getTime();
        if (slot.getTime() < windowStart || slot.getTime() + slotMs > windowEnd)
            return false;
        return (slot.getTime() - windowStart) % slotMs === 0;
    });
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
exports.bookPtSessions = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    const { tenantId, trainerId, slots: slotStrings } = request.data;
    if (!tenantId || !trainerId || !(slotStrings === null || slotStrings === void 0 ? void 0 : slotStrings.length)) {
        throw new https_1.HttpsError('invalid-argument', 'Eksik bilgi.');
    }
    const slots = slotStrings.map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
    if (slots.some((s) => s.getTime() <= Date.now())) {
        throw new https_1.HttpsError('invalid-argument', 'Geçmiş bir saat seçilemez.');
    }
    // A duplicate in the request itself (double-tap, retried request) would
    // otherwise book the same slot against itself — the per-slot
    // deterministic-id existence check below only catches a slot that's
    // already taken by SOME OTHER booking, not two copies within this one.
    if (new Set(slots.map((s) => s.getTime())).size !== slots.length) {
        throw new https_1.HttpsError('invalid-argument', 'Aynı saat birden fazla kez seçilemez.');
    }
    const db = admin.firestore();
    const membershipRef = db.doc(`tenant_memberships/${tenantId}_${uid}`);
    const trainerMembershipRef = db.doc(`tenant_memberships/${tenantId}_${trainerId}`);
    const availabilityRef = db.doc(`trainer_availability/${tenantId}_${trainerId}`);
    // Deterministic per-slot id (plan-eng-review Faz 1.5): a query-then-
    // auto-ID-write ("is this slot taken? no → create a new doc") only
    // protects against contention Firestore can actually detect if the
    // two racing transactions' read sets overlap. A *query's* result set is
    // not a tracked read for that purpose — two concurrent bookings for the
    // same slot could both see "no session yet" and both write, producing
    // two sessions for one slot (a classic phantom read). Reading this
    // exact document inside the transaction, instead, means both
    // transactions share a read on the *same* document; Firestore's
    // optimistic concurrency then guarantees only one of them commits.
    const sessionRefs = slots.map((slot) => db.collection('pt_sessions').doc(`${tenantId}_${trainerId}_${slot.getTime()}`));
    const result = await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const [membershipSnap, trainerMembershipSnap, availabilitySnap, ...sessionSnaps] = await Promise.all([
            tx.get(membershipRef),
            tx.get(trainerMembershipRef),
            tx.get(availabilityRef),
            ...sessionRefs.map((ref) => tx.get(ref)),
        ]);
        if (!membershipSnap.exists || membershipSnap.data().status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Bu salonda aktif üyeliğin yok.');
        }
        // Faz 1.8: `trainerMembershipSnap` used to be read only for its
        // display name — never checked for existing, active, or actually
        // holding the trainer role. A trainer who left the gym (membership
        // `status` flipped away from `active`) could still be booked and
        // burn the member's credit for a session that will never happen.
        const trainerMembership = trainerMembershipSnap.data();
        if (!trainerMembershipSnap.exists || trainerMembership.status !== 'active' || !((_a = trainerMembership.roles) !== null && _a !== void 0 ? _a : []).includes('trainer')) {
            throw new https_1.HttpsError('failed-precondition', 'Bu antrenör artık salonda çalışmıyor.');
        }
        if (!availabilitySnap.exists) {
            throw new https_1.HttpsError('failed-precondition', 'Bu antrenör çalışma saatlerini henüz tanımlamamış.');
        }
        const availability = availabilitySnap.data();
        for (const slot of slots) {
            if (!isWithinAvailability(availability, slot)) {
                throw new https_1.HttpsError('failed-precondition', `${slot.toLocaleString('tr-TR')} antrenörün çalışma saatleri dışında.`);
            }
        }
        sessionSnaps.forEach((snap, i) => {
            if (snap.exists && snap.data().status !== 'cancelled') {
                throw new https_1.HttpsError('failed-precondition', `${slots[i].toLocaleString('tr-TR')} az önce doldu, başka bir saat seç.`);
            }
        });
        // Faz 1.4: credits must still be unexpired *as of now* (the stored
        // read-time-check discipline every other quota in this schema uses —
        // see `member_entitlements.endsAt > request.time`) — and, separately,
        // a credit can only pay for a slot that falls before it expires. A
        // credit expiring in 3 days must not be spent on a session 3 months
        // out.
        const now = admin.firestore.Timestamp.now();
        const creditsSnap = await tx.get(db
            .collection('member_credits')
            .where('tenantId', '==', tenantId)
            .where('memberId', '==', uid)
            .where('kind', '==', 'ptLesson')
            .where('status', '==', 'active')
            .where('expiresAt', '>', now)
            .orderBy('expiresAt', 'asc'));
        const credits = creditsSnap.docs.map((d) => ({
            ref: d.ref,
            total: d.data().total,
            used: d.data().used,
            expiresAt: d.data().expiresAt,
        }));
        // Spend earliest-expiring-first, but only among credits still valid
        // on THIS slot's date — not a single upfront balance sum.
        const remaining = new Map(credits.map((c) => [c.ref.id, c.total - c.used]));
        const creditIdBySlot = [];
        for (const slot of slots) {
            const eligible = credits.find((c) => { var _a; return ((_a = remaining.get(c.ref.id)) !== null && _a !== void 0 ? _a : 0) > 0 && c.expiresAt.toMillis() >= slot.getTime(); });
            if (!eligible) {
                throw new https_1.HttpsError('failed-precondition', `${slot.toLocaleString('tr-TR')} tarihi için geçerli ders kredin yok.`);
            }
            remaining.set(eligible.ref.id, remaining.get(eligible.ref.id) - 1);
            creditIdBySlot.push(eligible.ref.id);
        }
        const trainerName = (_c = (_b = trainerMembership.userDisplayName) !== null && _b !== void 0 ? _b : trainerMembership.userEmail) !== null && _c !== void 0 ? _c : 'Antrenör';
        const memberName = (_g = (_e = (_d = membershipSnap.data()) === null || _d === void 0 ? void 0 : _d.userDisplayName) !== null && _e !== void 0 ? _e : (_f = membershipSnap.data()) === null || _f === void 0 ? void 0 : _f.userEmail) !== null && _g !== void 0 ? _g : 'Üye';
        slots.forEach((slot, i) => {
            var _a;
            tx.set(sessionRefs[i], {
                tenantId,
                trainerId,
                trainerName,
                memberId: uid,
                memberName,
                date: admin.firestore.Timestamp.fromDate(slot),
                durationMinutes: (_a = availability.slotMinutes) !== null && _a !== void 0 ? _a : 60,
                status: 'scheduled',
                creditId: creditIdBySlot[i],
                createdAt: now,
                updatedAt: now,
            });
        });
        const spendPerCredit = new Map();
        for (const id of creditIdBySlot)
            spendPerCredit.set(id, ((_h = spendPerCredit.get(id)) !== null && _h !== void 0 ? _h : 0) + 1);
        for (const credit of credits) {
            const spent = spendPerCredit.get(credit.ref.id);
            if (!spent)
                continue;
            const newUsed = credit.used + spent;
            tx.update(credit.ref, Object.assign({ used: newUsed }, (newUsed >= credit.total ? { status: 'exhausted' } : {})));
        }
        return { booked: slots.length };
    });
    console.log(`Member ${uid} booked ${result.booked} session(s) with trainer ${trainerId}`);
    return result;
});
/**
 * GymEntra (PKG-11, plan-eng-review Faz 1.9): cancels a PT session and
 * decides whether the credit that paid for it comes back.
 *
 * A credit-linked session's direct `status: 'cancelled'` client write is
 * closed in the rule (see `firestore.rules`) — refunding has to be decided
 * atomically with the cancellation itself, and rules can't run the
 * "how many hours until the appointment" arithmetic this needs. A session
 * with no `creditId` (a trainer's own, package-independent booking) has no
 * refund decision to make, but still routes through here so cancellation
 * behaves the same way regardless of who's cancelling — one code path, not
 * "credit sessions cancel here, everything else cancels by direct write."
 *
 * Refund policy: the trainer or an admin cancelling always refunds — the
 * member didn't cause the cancellation. A member cancelling refunds only
 * if it's at least `tenants/{tenantId}.cancellationHours` (default 24)
 * before the appointment; later than that, the credit burns, which is why
 * the client shows this explicitly before the member confirms.
 */
exports.cancelPtSession = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    const { sessionId } = request.data;
    if (!sessionId)
        throw new https_1.HttpsError('invalid-argument', 'Eksik bilgi.');
    const db = admin.firestore();
    const sessionRef = db.doc(`pt_sessions/${sessionId}`);
    const result = await db.runTransaction(async (tx) => {
        var _a, _b, _c;
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists)
            throw new https_1.HttpsError('not-found', 'Randevu bulunamadı.');
        const session = sessionSnap.data();
        if (session.status === 'cancelled')
            throw new https_1.HttpsError('failed-precondition', 'Randevu zaten iptal edilmiş.');
        if (session.status === 'completed')
            throw new https_1.HttpsError('failed-precondition', 'Tamamlanmış randevu iptal edilemez.');
        const isMember = session.memberId === uid;
        const isTrainer = session.trainerId === uid;
        let isAdmin = false;
        if (!isMember && !isTrainer) {
            const membershipSnap = await tx.get(db.doc(`tenant_memberships/${session.tenantId}_${uid}`));
            const membership = membershipSnap.data();
            isAdmin = !!membership && membership.status === 'active' && ((_a = membership.roles) !== null && _a !== void 0 ? _a : []).includes('admin');
        }
        if (!isMember && !isTrainer && !isAdmin)
            throw new https_1.HttpsError('permission-denied', 'Bu randevuyu iptal edemezsin.');
        let creditRef = null;
        let creditSnap = null;
        if (session.creditId) {
            creditRef = db.doc(`member_credits/${session.creditId}`);
            creditSnap = await tx.get(creditRef);
        }
        let refunded = false;
        if (creditRef && (creditSnap === null || creditSnap === void 0 ? void 0 : creditSnap.exists)) {
            let shouldRefund = isTrainer || isAdmin;
            if (isMember && !shouldRefund) {
                const tenantSnap = await tx.get(db.doc(`tenants/${session.tenantId}`));
                const cancellationHours = (_c = (_b = tenantSnap.data()) === null || _b === void 0 ? void 0 : _b.cancellationHours) !== null && _c !== void 0 ? _c : 24;
                const hoursUntilSession = (session.date.toMillis() - Date.now()) / 3600000;
                shouldRefund = hoursUntilSession >= cancellationHours;
            }
            if (shouldRefund) {
                const credit = creditSnap.data();
                tx.update(creditRef, Object.assign({ used: Math.max(0, credit.used - 1) }, (credit.status === 'exhausted' ? { status: 'active' } : {})));
                refunded = true;
            }
        }
        tx.update(sessionRef, { status: 'cancelled', updatedAt: admin.firestore.Timestamp.now() });
        return { refunded };
    });
    console.log(`Session ${sessionId} cancelled by ${uid}, refunded=${result.refunded}`);
    return result;
});
//# sourceMappingURL=sessions.js.map