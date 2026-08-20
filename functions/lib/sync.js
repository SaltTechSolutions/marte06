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
exports.syncTrainerBusySlots = exports.syncMemberEntitlements = exports.syncPackageAssignmentCount = exports.syncActiveMemberCount = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
/**
 * GymEntra: keeps `tenants/{id}.activeMemberCount` in step with reality.
 *
 * The free-tier limit has to be enforceable on the server, but Firestore
 * rules cannot count documents — they can only read one. So the count is
 * denormalised here and the rules read it.
 *
 * Only the `member` role counts: trainers and admins are staff, and a gym
 * should never be pushed onto a paid plan by hiring a coach.
 */
exports.syncActiveMemberCount = (0, firestore_1.onDocumentWritten)({ document: 'tenant_memberships/{membershipId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d, _e;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const tenantId = ((_e = after === null || after === void 0 ? void 0 : after.tenantId) !== null && _e !== void 0 ? _e : before === null || before === void 0 ? void 0 : before.tenantId);
    if (!tenantId)
        return;
    const countsAsMember = (d) => {
        var _a;
        if (!d || d.status !== 'active')
            return false;
        const roles = (_a = d.roles) !== null && _a !== void 0 ? _a : (d.role ? [d.role] : []);
        return roles.includes('member');
    };
    // Nothing that affects the tally changed — skip the recount.
    if (countsAsMember(before) === countsAsMember(after))
        return;
    const db = admin.firestore();
    const snap = await db
        .collection('tenant_memberships')
        .where('tenantId', '==', tenantId)
        .where('status', '==', 'active')
        .where('roles', 'array-contains', 'member')
        .count()
        .get();
    const activeMemberCount = snap.data().count;
    await db.collection('tenants').doc(tenantId).set({ activeMemberCount }, { merge: true });
    console.log(`Tenant ${tenantId} now has ${activeMemberCount} active member(s)`);
});
/**
 * GymEntra (PKG-1): keeps `gym_packages.activeAssignmentCount` in sync with
 * how many `member_packages` actually point at it. Rules read this tally to
 * decide whether a package's content is still editable — rules cannot count
 * documents themselves, same reasoning as `syncActiveMemberCount` above.
 *
 * Counts `active` and `frozen` assignments as "in use" (a frozen package is
 * still sold, just paused); `expired`/`cancelled` free the slot.
 */
exports.syncPackageAssignmentCount = (0, firestore_1.onDocumentWritten)({ document: 'member_packages/{assignmentId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d, _e;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const packageId = ((_e = after === null || after === void 0 ? void 0 : after.packageId) !== null && _e !== void 0 ? _e : before === null || before === void 0 ? void 0 : before.packageId);
    if (!packageId)
        return;
    const inUse = (d) => !!d && ['active', 'frozen'].includes(d.status);
    if (inUse(before) === inUse(after))
        return;
    const db = admin.firestore();
    const snap = await db
        .collection('member_packages')
        .where('packageId', '==', packageId)
        .where('status', 'in', ['active', 'frozen'])
        .count()
        .get();
    const activeAssignmentCount = snap.data().count;
    await db.collection('gym_packages').doc(packageId).set({ activeAssignmentCount }, { merge: true });
    console.log(`Package ${packageId} now has ${activeAssignmentCount} active assignment(s)`);
});
/**
 * GymEntra (PKG-4): keeps `member_entitlements/{tenantId}_{memberId}` —
 * a one-document cache of a member's *current* membership package's
 * entitlements — in sync with `member_packages`.
 *
 * Security rules need this because they cannot run the query
 * `getMemberPackages` uses ("find the member's active membership-kind
 * package") to gate a group-class booking; a `get()` on a deterministic id
 * is the only shape rules can check. Same reasoning as
 * `syncActiveMemberCount` and `syncPackageAssignmentCount` above — rules
 * cannot count or query, so a Cloud Function keeps a small denormalized
 * pointer current instead.
 *
 * "Current" = the active, non-expired membership package with the latest
 * `endsAt` — a member should realistically hold at most one at a time, but
 * picking the longest-lasting active one is the sane tiebreaker if two ever
 * overlap (e.g. mid-upgrade).
 */
exports.syncMemberEntitlements = (0, firestore_1.onDocumentWritten)({ document: 'member_packages/{assignmentId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    const after = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
    const before = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.before) === null || _d === void 0 ? void 0 : _d.data();
    const tenantId = ((_e = after === null || after === void 0 ? void 0 : after.tenantId) !== null && _e !== void 0 ? _e : before === null || before === void 0 ? void 0 : before.tenantId);
    const memberId = ((_f = after === null || after === void 0 ? void 0 : after.memberId) !== null && _f !== void 0 ? _f : before === null || before === void 0 ? void 0 : before.memberId);
    if (!tenantId || !memberId)
        return;
    const db = admin.firestore();
    const cacheRef = db.doc(`member_entitlements/${tenantId}_${memberId}`);
    // Same fetch-all-and-filter-in-code shape as the client's
    // getMemberPackages: a member holds a handful of packages at most, and
    // this avoids a composite index just for this one background job.
    const snap = await db
        .collection('member_packages')
        .where('tenantId', '==', tenantId)
        .where('memberId', '==', memberId)
        .orderBy('endsAt', 'desc')
        .limit(10)
        .get();
    const now = admin.firestore.Timestamp.now();
    const current = snap.docs.find((d) => {
        const p = d.data();
        return p.kind === 'membership' && p.status === 'active' && p.endsAt.toMillis() >= now.toMillis();
    });
    if (!current) {
        await cacheRef.delete();
        return;
    }
    const currentData = current.data();
    await cacheRef.set({
        tenantId,
        memberId,
        packageId: current.id,
        entitlements: currentData.entitlements,
        endsAt: currentData.endsAt,
        updatedAt: now,
    });
});
/**
 * GymEntra (PKG-8): keeps `trainer_busy_slots` — the privacy-stripped mirror
 * a browsing member reads to find a free time — in sync with `pt_sessions`.
 * See that collection's own rule comment for why it has to be a separate
 * doc rather than widening `pt_sessions` read access.
 */
exports.syncTrainerBusySlots = (0, firestore_1.onDocumentWritten)({ document: 'pt_sessions/{sessionId}', region: 'europe-west1' }, async (event) => {
    var _a;
    const after = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    const slotRef = admin.firestore().doc(`trainer_busy_slots/${event.params.sessionId}`);
    if (!(after === null || after === void 0 ? void 0 : after.exists)) {
        await slotRef.delete();
        return;
    }
    const data = after.data();
    await slotRef.set({
        tenantId: data.tenantId,
        trainerId: data.trainerId,
        date: data.date,
        durationMinutes: data.durationMinutes,
        status: data.status,
    });
});
//# sourceMappingURL=sync.js.map