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
exports.notifyOnClassCancelled = exports.notifyAdminsOnMemberLeft = exports.notifyAdminsOnJoinRequest = exports.notifyOnPackageChangeRequested = exports.notifyOnProgramAssigned = exports.notifyOnPaymentStatusChange = exports.notifyOnMembershipApproved = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const push_1 = require("./push");
/** GymEntra: member's join request just got approved. */
exports.notifyOnMembershipApproved = (0, firestore_1.onDocumentUpdated)({ document: 'tenant_memberships/{membershipId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after)
        return;
    if (before.status === 'active' || after.status !== 'active')
        return;
    await (0, push_1.sendPushToUser)(after.userId, 'Üyeliğin onaylandı 🎉', `${after.tenantName} ailesine hoş geldin! Üyelik kartın artık hazır.`, { screen: 'member/card' });
});
/** GymEntra: a member-submitted payment notice was confirmed or rejected. */
exports.notifyOnPaymentStatusChange = (0, firestore_1.onDocumentUpdated)({ document: 'payments/{paymentId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after)
        return;
    if (before.status !== 'pending' || after.status === 'pending')
        return;
    const amountLabel = `₺${Number(after.amount).toLocaleString('tr-TR')}`;
    if (after.status === 'confirmed') {
        await (0, push_1.sendPushToUser)(after.memberId, 'Ödemen onaylandı ✓', `${amountLabel} tutarındaki ödemen onaylandı.`, {
            screen: 'member/payments',
        });
    }
    else if (after.status === 'rejected') {
        await (0, push_1.sendPushToUser)(after.memberId, 'Ödemen onaylanmadı', `${amountLabel} tutarındaki ödeme bildirimin reddedildi. Detay için salonla iletişime geç.`, { screen: 'member/payments' });
    }
});
/** GymEntra: a trainer just assigned (activated) a program for this member. */
exports.notifyOnProgramAssigned = (0, firestore_1.onDocumentUpdated)({ document: 'programs/{programId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after)
        return;
    if (before.status === 'active' || after.status !== 'active')
        return;
    await (0, push_1.sendPushToUser)(after.memberId, 'Yeni programın hazır 💪', `Antrenörün senin için "${after.name}" programını hazırladı.`, { screen: 'member/workout' });
});
/**
 * GymEntra (PKG-6): notifies the member a swap is waiting on them.
 * `createPackageChangeRequest` never writes anything to `member_packages`
 * itself — this is purely "someone should look at this."
 */
exports.notifyOnPackageChangeRequested = (0, firestore_1.onDocumentCreated)({ document: 'package_change_requests/{requestId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    await (0, push_1.sendPushToUser)(data.memberId, 'Paket teklifin var', `${(_c = (_b = data.proposedSummary) === null || _b === void 0 ? void 0 : _b.packageName) !== null && _c !== void 0 ? _c : 'Yeni paket'} için bir teklif bekliyor.`, { screen: 'member/index' });
});
/**
 * Pushes to every ACTIVE admin of a gym.
 *
 * Fans out rather than targeting an owner field: a gym can have several
 * admins, and whoever happens to own the tenant document is not necessarily
 * the one working the desk today.
 */
async function notifyTenantAdmins(tenantId, title, body, data) {
    const admins = await admin
        .firestore()
        .collection('tenant_memberships')
        .where('tenantId', '==', tenantId)
        .where('roles', 'array-contains', 'admin')
        .where('status', '==', 'active')
        .get();
    await Promise.all(admins.docs.map((d) => (0, push_1.sendPushToUser)(d.data().userId, title, body, data)));
}
/**
 * GymEntra: a join request is waiting for the gym's approval.
 *
 * The owner's most time-sensitive event — someone may be standing at the
 * desk. Until this existed the only way to find out was to open the app and
 * look, which is how requests sat unnoticed.
 *
 * `onDocumentWritten`, not `onDocumentCreated`: a rejoin (P0-6) is an UPDATE
 * back to `pending` on the document the person already owns, so a
 * create-only trigger would miss every returning member.
 */
exports.notifyAdminsOnJoinRequest = (0, firestore_1.onDocumentWritten)({ document: 'tenant_memberships/{membershipId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!after)
        return;
    if ((before === null || before === void 0 ? void 0 : before.status) === 'pending' || after.status !== 'pending')
        return;
    const who = after.userDisplayName || after.userEmail || 'Biri';
    const returning = before !== undefined;
    await notifyTenantAdmins(after.tenantId, 'Yeni katılım isteği', returning ? `${who} salona tekrar katılmak istiyor.` : `${who} salona katılmak istiyor.`, { screen: 'admin/members' });
});
/**
 * GymEntra: tells the gym's admins that someone walked away.
 *
 * Leaving is entirely self-service (`leaveTenant` writes `status: 'left'`
 * straight from the client), so without this the roster silently shrinks and
 * the owner finds out by noticing a missing name. A gym billed per active
 * member needs to know the moment a seat frees up.
 *
 * Fans out to every active admin rather than an owner field: a gym can have
 * several, and the one who happens to own the tenant doc is not necessarily
 * the one working the desk.
 */
exports.notifyAdminsOnMemberLeft = (0, firestore_1.onDocumentUpdated)({ document: 'tenant_memberships/{membershipId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after)
        return;
    if (before.status === 'left' || after.status !== 'left')
        return;
    const who = after.userDisplayName || after.userEmail || 'Bir üye';
    await notifyTenantAdmins(after.tenantId, 'Bir üye salondan ayrıldı', `${who} üyeliğini sonlandırdı.`, {
        screen: 'admin/members',
    });
});
/**
 * GymEntra: a class was cancelled — tell the people who had booked it.
 *
 * Cancelling is the one admin action that silently changes somebody else's
 * plans: the class simply vanishes from their schedule. Without this a member
 * turns up to a session that no longer exists.
 *
 * Fired on delete rather than on a `cancelled` flag because that is what
 * `deleteClass` does today. The waitlist is notified too — they were holding
 * a place for this slot and their answer ("am I in?") is now settled.
 */
exports.notifyOnClassCancelled = (0, firestore_1.onDocumentDeleted)({ document: 'classes/{classId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const affected = [
        ...((_b = data.bookedUserIds) !== null && _b !== void 0 ? _b : []),
        ...((_c = data.waitlistUserIds) !== null && _c !== void 0 ? _c : []),
    ];
    if (affected.length === 0)
        return;
    const when = (_d = data.date) === null || _d === void 0 ? void 0 : _d.toDate();
    const whenLabel = when
        ? when.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
        : '';
    await Promise.all(affected.map((uid) => {
        var _a;
        return (0, push_1.sendPushToUser)(uid, 'Ders iptal edildi', `${(_a = data.name) !== null && _a !== void 0 ? _a : 'Ders'}${whenLabel ? ` — ${whenLabel}` : ''} iptal edildi.`, { screen: 'member/classes' });
    }));
});
//# sourceMappingURL=notifications.js.map