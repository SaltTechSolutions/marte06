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
exports.cancelGroupClassBooking = exports.bookGroupClass = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
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
exports.bookGroupClass = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b, _c, _d, _e;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    const classId = String((_c = (_b = request.data) === null || _b === void 0 ? void 0 : _b.classId) !== null && _c !== void 0 ? _c : '').trim();
    const memberId = String((_e = (_d = request.data) === null || _d === void 0 ? void 0 : _d.memberId) !== null && _e !== void 0 ? _e : uid).trim();
    if (!classId)
        throw new https_1.HttpsError('invalid-argument', 'Ders bilgisi eksik.');
    const classRef = db().doc(`classes/${classId}`);
    const result = await db().runTransaction(async (tx) => {
        var _a, _b, _c;
        const classSnap = await tx.get(classRef);
        if (!classSnap.exists)
            throw new https_1.HttpsError('not-found', 'Ders bulunamadı.');
        const klass = classSnap.data();
        const tenantId = klass.tenantId;
        // Acting for someone else is only ever a guardian acting for their child
        // (MEMBER-5c) — the same authority PT booking recognises.
        if (memberId !== uid) {
            const childSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${memberId}`));
            const child = childSnap.data();
            if (!childSnap.exists || child.guardianId !== uid || child.guardianStatus !== 'approved') {
                throw new https_1.HttpsError('permission-denied', 'Bu üye adına işlem yapamazsın.');
            }
        }
        const membershipSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${memberId}`));
        if (!membershipSnap.exists || membershipSnap.data().status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Bu salonda aktif üyeliğin yok.');
        }
        const booked = (_a = klass.bookedUserIds) !== null && _a !== void 0 ? _a : [];
        const waitlist = (_b = klass.waitlistUserIds) !== null && _b !== void 0 ? _b : [];
        if (booked.includes(memberId))
            return { status: 'already-booked' };
        if (waitlist.includes(memberId))
            return { status: 'already-waitlisted' };
        const now = admin.firestore.Timestamp.now();
        const classDate = klass.date;
        if (classDate.toMillis() < Date.now()) {
            throw new https_1.HttpsError('failed-precondition', 'Geçmiş bir derse kayıt olunamaz.');
        }
        // Full: waitlist, and spend nothing.
        if (booked.length >= klass.capacity) {
            tx.update(classRef, { waitlistUserIds: admin.firestore.FieldValue.arrayUnion(memberId) });
            return { status: 'waitlisted' };
        }
        const cacheSnap = await tx.get(db().doc(`member_entitlements/${tenantId}_${memberId}`));
        const cache = cacheSnap.data();
        const endsAt = cache === null || cache === void 0 ? void 0 : cache.endsAt;
        if (!cache || !endsAt || endsAt.toMillis() < Date.now()) {
            throw new https_1.HttpsError('failed-precondition', 'Aktif bir paketin yok.');
        }
        const groupClasses = (_c = cache.entitlements) === null || _c === void 0 ? void 0 : _c.groupClasses;
        if (!groupClasses) {
            throw new https_1.HttpsError('failed-precondition', 'Paketin grup dersi içermiyor.');
        }
        // Unlimited never reaches here from the app, but a direct call must still
        // behave: no credit to spend, just take the place.
        if (groupClasses.unlimited === true) {
            tx.update(classRef, { bookedUserIds: admin.firestore.FieldValue.arrayUnion(memberId) });
            return { status: 'booked' };
        }
        // Same discipline as PT: earliest-expiring first, and a credit can only
        // pay for a class that falls before it expires — a credit good for three
        // more days must not buy a place three months out.
        const creditsSnap = await tx.get(db()
            .collection('member_credits')
            .where('tenantId', '==', tenantId)
            .where('memberId', '==', memberId)
            .where('kind', '==', 'groupClass')
            .where('status', '==', 'active')
            .where('expiresAt', '>', now)
            .orderBy('expiresAt', 'asc'));
        const credit = creditsSnap.docs.find((d) => {
            const c = d.data();
            return c.total - c.used > 0 && c.expiresAt.toMillis() >= classDate.toMillis();
        });
        if (!credit) {
            throw new https_1.HttpsError('failed-precondition', 'Bu ders için geçerli grup dersi hakkın kalmadı.');
        }
        const c = credit.data();
        const newUsed = c.used + 1;
        tx.update(credit.ref, Object.assign({ used: newUsed }, (newUsed >= c.total ? { status: 'exhausted' } : {})));
        tx.update(classRef, {
            bookedUserIds: admin.firestore.FieldValue.arrayUnion(memberId),
            // Which credit paid for this place, so cancelling can put back the same
            // one rather than guessing at the member's current balance.
            [`bookingCredits.${memberId}`]: credit.ref.id,
        });
        return { status: 'booked', creditId: credit.ref.id };
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
exports.cancelGroupClassBooking = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b, _c, _d, _e;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    const classId = String((_c = (_b = request.data) === null || _b === void 0 ? void 0 : _b.classId) !== null && _c !== void 0 ? _c : '').trim();
    const memberId = String((_e = (_d = request.data) === null || _d === void 0 ? void 0 : _d.memberId) !== null && _e !== void 0 ? _e : uid).trim();
    if (!classId)
        throw new https_1.HttpsError('invalid-argument', 'Ders bilgisi eksik.');
    const classRef = db().doc(`classes/${classId}`);
    const result = await db().runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e, _f;
        const classSnap = await tx.get(classRef);
        if (!classSnap.exists)
            throw new https_1.HttpsError('not-found', 'Ders bulunamadı.');
        const klass = classSnap.data();
        const tenantId = klass.tenantId;
        const callerSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${uid}`));
        const caller = callerSnap.data();
        const roles = (_a = caller === null || caller === void 0 ? void 0 : caller.roles) !== null && _a !== void 0 ? _a : [];
        const isStaff = callerSnap.exists && caller.status === 'active' && (roles.includes('admin') || roles.includes('trainer'));
        if (memberId !== uid && !isStaff) {
            const childSnap = await tx.get(db().doc(`tenant_memberships/${tenantId}_${memberId}`));
            const child = childSnap.data();
            if (!childSnap.exists || child.guardianId !== uid || child.guardianStatus !== 'approved') {
                throw new https_1.HttpsError('permission-denied', 'Bu üye adına işlem yapamazsın.');
            }
        }
        const booked = (_b = klass.bookedUserIds) !== null && _b !== void 0 ? _b : [];
        const waitlist = (_c = klass.waitlistUserIds) !== null && _c !== void 0 ? _c : [];
        // Leaving the waitlist costs nothing and refunds nothing — no credit was
        // ever spent to sit on it.
        if (!booked.includes(memberId)) {
            if (!waitlist.includes(memberId))
                return { refunded: false, wasBooked: false };
            tx.update(classRef, { waitlistUserIds: admin.firestore.FieldValue.arrayRemove(memberId) });
            return { refunded: false, wasBooked: false };
        }
        const creditId = (_d = klass.bookingCredits) === null || _d === void 0 ? void 0 : _d[memberId];
        let refunded = false;
        if (creditId) {
            const creditRef = db().doc(`member_credits/${creditId}`);
            const creditSnap = await tx.get(creditRef);
            if (creditSnap.exists) {
                let shouldRefund = isStaff;
                if (!shouldRefund) {
                    const tenantSnap = await tx.get(db().doc(`tenants/${tenantId}`));
                    const cancellationHours = (_f = (_e = tenantSnap.data()) === null || _e === void 0 ? void 0 : _e.cancellationHours) !== null && _f !== void 0 ? _f : 24;
                    const hoursUntil = (klass.date.toMillis() - Date.now()) / 3600000;
                    shouldRefund = hoursUntil >= cancellationHours;
                }
                if (shouldRefund) {
                    const c = creditSnap.data();
                    tx.update(creditRef, Object.assign({ used: Math.max(0, c.used - 1) }, (c.status === 'exhausted' ? { status: 'active' } : {})));
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
//# sourceMappingURL=groupClasses.js.map