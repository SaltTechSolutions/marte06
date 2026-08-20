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
exports.bookPtSessions = void 0;
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
/** Same rule the client's `computeFreeSlots` shows the member — re-derived
 *  here because a client-side "this slot looked free" is UX, not a
 *  guarantee; this is the actual gate. */
function isWithinAvailability(availability, slot) {
    var _a, _b, _c, _d;
    const exception = ((_a = availability.exceptions) !== null && _a !== void 0 ? _a : []).find((e) => e.date === isoDateOf(slot));
    if (exception === null || exception === void 0 ? void 0 : exception.closed)
        return false;
    const windows = (_d = (_b = exception === null || exception === void 0 ? void 0 : exception.windows) !== null && _b !== void 0 ? _b : (_c = availability.weekly) === null || _c === void 0 ? void 0 : _c[weekdayOf(slot)]) !== null && _d !== void 0 ? _d : [];
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
    const db = admin.firestore();
    const membershipRef = db.doc(`tenant_memberships/${tenantId}_${uid}`);
    const trainerMembershipRef = db.doc(`tenant_memberships/${tenantId}_${trainerId}`);
    const availabilityRef = db.doc(`trainer_availability/${tenantId}_${trainerId}`);
    const result = await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const [membershipSnap, trainerMembershipSnap, availabilitySnap] = await Promise.all([
            tx.get(membershipRef),
            tx.get(trainerMembershipRef),
            tx.get(availabilityRef),
        ]);
        if (!membershipSnap.exists || membershipSnap.data().status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Bu salonda aktif üyeliğin yok.');
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
        const dayStart = new Date(slots[0]);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(slots[slots.length - 1]);
        dayEnd.setDate(dayEnd.getDate() + 1);
        dayEnd.setHours(0, 0, 0, 0);
        const existingSnap = await tx.get(db
            .collection('pt_sessions')
            .where('tenantId', '==', tenantId)
            .where('trainerId', '==', trainerId)
            .where('date', '>=', admin.firestore.Timestamp.fromDate(dayStart))
            .where('date', '<', admin.firestore.Timestamp.fromDate(dayEnd)));
        const taken = new Set(existingSnap.docs.filter((d) => d.data().status !== 'cancelled').map((d) => d.data().date.toMillis()));
        for (const slot of slots) {
            if (taken.has(slot.getTime())) {
                throw new https_1.HttpsError('failed-precondition', `${slot.toLocaleString('tr-TR')} az önce doldu, başka bir saat seç.`);
            }
        }
        const creditsSnap = await tx.get(db
            .collection('member_credits')
            .where('tenantId', '==', tenantId)
            .where('memberId', '==', uid)
            .where('kind', '==', 'ptLesson')
            .where('status', '==', 'active')
            .orderBy('expiresAt', 'asc'));
        const credits = creditsSnap.docs.map((d) => ({ ref: d.ref, total: d.data().total, used: d.data().used }));
        const totalRemaining = credits.reduce((sum, c) => sum + (c.total - c.used), 0);
        if (totalRemaining < slots.length) {
            throw new https_1.HttpsError('failed-precondition', `Yeterli ders kredin yok — ${totalRemaining} kaldı, ${slots.length} gerekiyor.`);
        }
        // Spend earliest-expiring credits first, same order the member sees them in.
        const creditIdBySlot = [];
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
        const trainerName = (_d = (_b = (_a = trainerMembershipSnap.data()) === null || _a === void 0 ? void 0 : _a.userDisplayName) !== null && _b !== void 0 ? _b : (_c = trainerMembershipSnap.data()) === null || _c === void 0 ? void 0 : _c.userEmail) !== null && _d !== void 0 ? _d : 'Antrenör';
        const memberName = (_h = (_f = (_e = membershipSnap.data()) === null || _e === void 0 ? void 0 : _e.userDisplayName) !== null && _f !== void 0 ? _f : (_g = membershipSnap.data()) === null || _g === void 0 ? void 0 : _g.userEmail) !== null && _h !== void 0 ? _h : 'Üye';
        const now = admin.firestore.Timestamp.now();
        slots.forEach((slot, i) => {
            var _a;
            tx.set(db.collection('pt_sessions').doc(), {
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
            spendPerCredit.set(id, ((_j = spendPerCredit.get(id)) !== null && _j !== void 0 ? _j : 0) + 1);
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
//# sourceMappingURL=sessions.js.map