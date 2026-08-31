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
exports.syncTenantNameToMemberships = exports.reconcileMirrors = exports.syncTrainerBusySlots = exports.syncMemberEntitlements = exports.syncPackageAssignmentCount = exports.syncActiveMemberCount = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
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
function timestampsEqual(a, b) {
    if (!a || !b)
        return a === b;
    return a.toMillis() === b.toMillis();
}
/** Plain-value deep equality — every field these mirrors carry is a
 *  JSON-safe primitive or a nested object of them (no arrays, no
 *  Timestamps inside nested objects), so this doesn't need to be general. */
function deepEqual(a, b) {
    if (a === b)
        return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
        return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length)
        return false;
    return aKeys.every((k) => deepEqual(a[k], b[k]));
}
/**
 * GymEntra (plan-eng-review Faz 2.3): the four sync functions above are
 * triggers — each one only fires on a write to the document it derives
 * from. A trigger that never fires (deploy gap, a write that predates the
 * trigger's existence, a dropped Cloud Functions event — rare but Google
 * documents it as possible) leaves a mirror wrong with nothing to correct
 * it; a wrong mirror is what a security rule trusts instead of the real
 * data. This job re-derives all four mirrors from their source collections
 * and overwrites whatever's wrong.
 *
 * Full collection scan, not scoped to a recent time window — the write
 * paths that create `member_packages`/`member_credits` don't reliably set
 * `updatedAt` yet (most don't), so a delta scan isn't possible without
 * first retrofitting every one of those call sites. At this project's
 * current scale (one pilot tenant, 51 members) a full scan costs nothing
 * worth optimizing for; if the platform grows to many tenants, revisit
 * this with `updatedAt`-scoped deltas per plan-eng-review's own PR2 note.
 * Runs weekly, not daily, for the same reason — nothing here needs to be
 * caught same-day, and every trigger above already keeps things correct in
 * the overwhelming majority of writes.
 */
exports.reconcileMirrors = (0, scheduler_1.onSchedule)({ schedule: 'every monday 03:00', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
    var _a, _b;
    const db = admin.firestore();
    let checked = 0;
    let fixed = 0;
    // --- 1. tenants.activeMemberCount ---
    const tenantsSnap = await db.collection('tenants').get();
    for (const tenantDoc of tenantsSnap.docs) {
        checked += 1;
        const countSnap = await db
            .collection('tenant_memberships')
            .where('tenantId', '==', tenantDoc.id)
            .where('status', '==', 'active')
            .where('roles', 'array-contains', 'member')
            .count()
            .get();
        const trueCount = countSnap.data().count;
        if (((_a = tenantDoc.data().activeMemberCount) !== null && _a !== void 0 ? _a : 0) !== trueCount) {
            await tenantDoc.ref.set({ activeMemberCount: trueCount }, { merge: true });
            fixed += 1;
            console.log(`[reconcile] tenants/${tenantDoc.id}.activeMemberCount → ${trueCount}`);
        }
    }
    // --- 2. gym_packages.activeAssignmentCount ---
    const packagesSnap = await db.collection('gym_packages').get();
    for (const pkgDoc of packagesSnap.docs) {
        checked += 1;
        const countSnap = await db
            .collection('member_packages')
            .where('packageId', '==', pkgDoc.id)
            .where('status', 'in', ['active', 'frozen'])
            .count()
            .get();
        const trueCount = countSnap.data().count;
        if (((_b = pkgDoc.data().activeAssignmentCount) !== null && _b !== void 0 ? _b : 0) !== trueCount) {
            await pkgDoc.ref.set({ activeAssignmentCount: trueCount }, { merge: true });
            fixed += 1;
            console.log(`[reconcile] gym_packages/${pkgDoc.id}.activeAssignmentCount → ${trueCount}`);
        }
    }
    // --- 3. member_entitlements ---
    // Both collections read up front (not per-key inside the loop below) —
    // an extra get() per member/session on top of an already full scan
    // would turn one big read into thousands of small ones for no benefit.
    const [allPackagesSnap, entitlementCachesSnap] = await Promise.all([
        db.collection('member_packages').get(),
        db.collection('member_entitlements').get(),
    ]);
    const cacheByKey = new Map(entitlementCachesSnap.docs.map((d) => [d.id, d.data()]));
    const byMember = new Map();
    for (const d of allPackagesSnap.docs) {
        const data = d.data();
        const key = `${data.tenantId}_${data.memberId}`;
        const existing = byMember.get(key);
        if (existing)
            existing.push(d);
        else
            byMember.set(key, [d]);
    }
    const now = admin.firestore.Timestamp.now();
    const seenEntitlementKeys = new Set();
    for (const [key, docs] of byMember) {
        checked += 1;
        seenEntitlementKeys.add(key);
        const current = docs
            .filter((d) => {
            const p = d.data();
            return p.kind === 'membership' && p.status === 'active' && p.endsAt.toMillis() >= now.toMillis();
        })
            .sort((a, b) => b.data().endsAt.toMillis() - a.data().endsAt.toMillis())[0];
        const cached = cacheByKey.get(key);
        if (!current) {
            if (cached) {
                await db.doc(`member_entitlements/${key}`).delete();
                fixed += 1;
                console.log(`[reconcile] member_entitlements/${key}: silindi (uygun paket yok)`);
            }
            continue;
        }
        const currentData = current.data();
        const matches = !!cached &&
            cached.packageId === current.id &&
            deepEqual(cached.entitlements, currentData.entitlements) &&
            timestampsEqual(cached.endsAt, currentData.endsAt);
        if (!matches) {
            await db.doc(`member_entitlements/${key}`).set({
                tenantId: currentData.tenantId,
                memberId: currentData.memberId,
                packageId: current.id,
                entitlements: currentData.entitlements,
                endsAt: currentData.endsAt,
                updatedAt: now,
            });
            fixed += 1;
            console.log(`[reconcile] member_entitlements/${key}: düzeltildi`);
        }
    }
    // Orphans: a cache exists for a member with no qualifying package left
    // at all (every trigger fired on a package write; this catches one
    // that never did).
    for (const key of cacheByKey.keys()) {
        checked += 1;
        if (!seenEntitlementKeys.has(key)) {
            await db.doc(`member_entitlements/${key}`).delete();
            fixed += 1;
            console.log(`[reconcile] member_entitlements/${key}: silindi (öksüz)`);
        }
    }
    // --- 4. trainer_busy_slots ---
    const [sessionsSnap, slotsSnap] = await Promise.all([
        db.collection('pt_sessions').get(),
        db.collection('trainer_busy_slots').get(),
    ]);
    const slotByKey = new Map(slotsSnap.docs.map((d) => [d.id, d.data()]));
    const seenSlotIds = new Set();
    for (const d of sessionsSnap.docs) {
        checked += 1;
        seenSlotIds.add(d.id);
        const data = d.data();
        const expected = {
            tenantId: data.tenantId,
            trainerId: data.trainerId,
            date: data.date,
            durationMinutes: data.durationMinutes,
            status: data.status,
        };
        const cached = slotByKey.get(d.id);
        const matches = !!cached &&
            cached.tenantId === expected.tenantId &&
            cached.trainerId === expected.trainerId &&
            timestampsEqual(cached.date, expected.date) &&
            cached.durationMinutes === expected.durationMinutes &&
            cached.status === expected.status;
        if (!matches) {
            await db.doc(`trainer_busy_slots/${d.id}`).set(expected);
            fixed += 1;
            console.log(`[reconcile] trainer_busy_slots/${d.id}: düzeltildi`);
        }
    }
    for (const id of slotByKey.keys()) {
        checked += 1;
        if (!seenSlotIds.has(id)) {
            await db.doc(`trainer_busy_slots/${id}`).delete();
            fixed += 1;
            console.log(`[reconcile] trainer_busy_slots/${id}: silindi (öksüz)`);
        }
    }
    console.log(`Mirror mutabakatı: ${checked} kontrol edildi, ${fixed} düzeltildi.`);
});
/**
 * Fans a renamed gym out to the `tenantName` copies on its membership docs.
 *
 * The name is denormalised because a client cannot read another user's Auth
 * profile or, from the member's side, the whole tenant list — the membership
 * doc has to carry enough to render "X salonu" on its own. The cost of that
 * is this: when the source changes the copies have to be rewritten, or the
 * roster keeps showing the old name forever.
 *
 * Server-side because a client may only write its own membership doc; renaming
 * the gym touches every member's.
 */
exports.syncTenantNameToMemberships = (0, firestore_1.onDocumentWritten)({ document: 'tenants/{tenantId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    // Only a rename matters. Branding and colour edits write this doc far more
    // often, and each one would otherwise rewrite the entire roster.
    if (!after || !before || before.name === after.name)
        return;
    const tenantId = event.params.tenantId;
    const db = admin.firestore();
    const snap = await db.collection('tenant_memberships').where('tenantId', '==', tenantId).get();
    if (snap.empty)
        return;
    // Batches cap at 500 writes; a large gym would silently lose the tail.
    let batch = db.batch();
    let pending = 0;
    let written = 0;
    for (const docSnap of snap.docs) {
        batch.update(docSnap.ref, { tenantName: after.name });
        pending += 1;
        written += 1;
        if (pending === 450) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
        }
    }
    if (pending > 0)
        await batch.commit();
    console.log(`Salon adı güncellendi (${tenantId}): ${written} üyelik kaydına yazıldı.`);
});
//# sourceMappingURL=sync.js.map