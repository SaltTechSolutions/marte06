"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOnPackageChangeRequested = exports.notifyOnProgramAssigned = exports.notifyOnPaymentStatusChange = exports.notifyOnMembershipApproved = void 0;
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
//# sourceMappingURL=notifications.js.map