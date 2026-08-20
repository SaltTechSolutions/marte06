"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promoteFromClassWaitlist = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const push_1 = require("./push");
/**
 * GymEntra: promotes the first person on a class waitlist when a spot frees up.
 *
 * Security rules deliberately cannot do this. Booking is modelled as a
 * single-uid self-toggle — a member may only add or remove their OWN uid, in
 * exactly one array, per write. Promotion moves a *different* user's uid
 * between two arrays in one write, which that model cannot express safely, so
 * until now an admin had to notice a cancellation and promote by hand.
 *
 * Runs with the Admin SDK, so it is the one place that write is safe.
 */
exports.promoteFromClassWaitlist = (0, firestore_1.onDocumentUpdated)({ document: 'classes/{classId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after)
        return;
    const capacity = after.capacity;
    const booked = (_e = after.bookedUserIds) !== null && _e !== void 0 ? _e : [];
    const waitlist = (_f = after.waitlistUserIds) !== null && _f !== void 0 ? _f : [];
    if (typeof capacity !== 'number' || waitlist.length === 0)
        return;
    // Only react to a spot actually opening; ignore our own promotion write
    // and any unrelated edit, otherwise this retriggers itself.
    const beforeBooked = (_g = before.bookedUserIds) !== null && _g !== void 0 ? _g : [];
    const freedUp = booked.length < beforeBooked.length;
    if (!freedUp || booked.length >= capacity)
        return;
    const promoted = waitlist[0];
    // A stale waitlist entry for someone already booked would otherwise
    // duplicate them.
    const nextBooked = booked.includes(promoted) ? booked : [...booked, promoted];
    await event.data.after.ref.update({
        bookedUserIds: nextBooked,
        waitlistUserIds: waitlist.slice(1),
    });
    await (0, push_1.sendPushToUser)(promoted, 'Yerin açıldı 🎉', `"${after.name}" dersinde bekleme listesinden çıktın, yerin hazır.`, { screen: 'member/classes' });
    console.log(`Promoted ${promoted} from waitlist of class ${event.params.classId}`);
});
//# sourceMappingURL=classes.js.map