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
exports.syncActiveMemberCount = exports.promoteFromClassWaitlist = exports.assignMembershipShortCode = exports.deleteMyAccount = exports.notifyOnProgramAssigned = exports.notifyOnPaymentStatusChange = exports.notifyOnMembershipApproved = exports.createAuthUserOnNewMember = exports.seedAdminClaims = exports.setAdminClaim = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK to interact with Firebase services
admin.initializeApp();
/**
 * Looks up every registered device for a user and pushes to all of them via
 * Expo's push service. Best-effort: a user with no tokens (never opened the
 * app, denied permission, simulator-only) is a silent no-op, not an error.
 */
async function sendPushToUser(userId, title, body, data) {
    var _a;
    const tokensSnap = await admin.firestore().collection('push_tokens').where('userId', '==', userId).get();
    if (tokensSnap.empty)
        return;
    const messages = tokensSnap.docs.map((tokenDoc) => (Object.assign({ to: tokenDoc.id, title,
        body, sound: 'default' }, (data ? { data } : {}))));
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
    });
    const result = (await response.json().catch(() => null));
    console.log(`Push to ${userId} (${messages.length} device(s)):`, JSON.stringify(result));
    // Expo answers per message, in the order we sent them. A DeviceNotRegistered
    // error means the app was uninstalled or the token was revoked — keeping it
    // costs a wasted request on every future push and the row never expires on
    // its own, so drop it here.
    const tickets = (_a = result === null || result === void 0 ? void 0 : result.data) !== null && _a !== void 0 ? _a : [];
    const dead = tickets
        .map((ticket, i) => { var _a; return (((_a = ticket === null || ticket === void 0 ? void 0 : ticket.details) === null || _a === void 0 ? void 0 : _a.error) === 'DeviceNotRegistered' ? tokensSnap.docs[i] : null); })
        .filter((doc) => doc != null);
    if (dead.length > 0) {
        const batch = admin.firestore().batch();
        dead.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Removed ${dead.length} dead push token(s) for ${userId}`);
    }
}
// Admin email list — used ONLY for the initial claim seeding.
// After claims are set, this list is no longer the source of truth.
const ADMIN_EMAILS = [
    'tarabyamarte@gmail.com',
    'tarkan.cicek@gmail.com',
];
/**
 * Callable Cloud Function to set the admin custom claim on a user.
 * Can only be called by an existing admin.
 */
exports.setAdminClaim = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b;
    // Verify the caller is an admin
    if (!((_b = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.admin)) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can grant admin access.');
    }
    const { email, isAdmin } = request.data;
    if (!email || typeof isAdmin !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'email (string) and isAdmin (boolean) are required.');
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: isAdmin });
        return { message: `Admin claim ${isAdmin ? 'granted' : 'revoked'} for ${email}.` };
    }
    catch (error) {
        console.error('Error setting admin claim:', error);
        throw new https_1.HttpsError('internal', 'Failed to set admin claim.');
    }
});
/**
 * One-time callable function to seed admin claims for the initial admin emails.
 * Should be called once during setup, then can be disabled or removed.
 * Can be called by any authenticated user whose email is in the ADMIN_EMAILS list.
 */
exports.seedAdminClaims = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b;
    const callerEmail = (_b = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.email;
    if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
        throw new https_1.HttpsError('permission-denied', 'Only designated admin emails can run the initial seed.');
    }
    const results = [];
    for (const email of ADMIN_EMAILS) {
        try {
            const user = await admin.auth().getUserByEmail(email);
            await admin.auth().setCustomUserClaims(user.uid, { admin: true });
            results.push(`✅ ${email}: admin claim set`);
        }
        catch (e) {
            results.push(`❌ ${email}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return { results };
});
/**
 * A Cloud Function that triggers when a new member is created in Firestore.
 * It creates a corresponding user in Firebase Authentication and updates the
 * member's document with the new auth UID.
 */
exports.createAuthUserOnNewMember = (0, firestore_1.onDocumentCreated)({
    document: 'members/{memberId}',
    region: 'europe-west1',
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log('No data associated with the event');
        return;
    }
    const memberData = snap.data();
    const { memberId } = event.params;
    // Exit if the new member doesn't have an email address
    if (!memberData.email) {
        console.log(`Member ${memberId} has no email, skipping auth user creation.`);
        return;
    }
    try {
        // Check if a user with this email already exists to avoid errors
        const existingUser = await admin.auth().getUserByEmail(memberData.email).catch(() => null);
        if (existingUser) {
            console.log(`User with email ${memberData.email} already exists. Linking UID.`);
            await snap.ref.update({ memberUid: existingUser.uid });
            return;
        }
        // Generate a random password for initial creation (not stored in Firestore)
        const tempPassword = Math.random().toString(36).slice(-12);
        const displayName = `${memberData.name || ''} ${memberData.surname || ''}`.trim();
        // Create the new user in Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: memberData.email,
            password: tempPassword,
            displayName,
            emailVerified: false,
        });
        console.log(`Successfully created auth user: ${userRecord.uid} for member: ${memberId}`);
        // Generate a password reset link for first-time password setup
        try {
            await admin.auth().generatePasswordResetLink(memberData.email);
            console.log(`Password reset link generated for ${memberData.email}.`);
        }
        catch (e) {
            console.warn(`Could not generate password reset link for ${memberData.email}:`, e);
        }
        // Update the member's document with the new UID
        await snap.ref.update({
            memberUid: userRecord.uid,
            passwordResetRequired: true,
        });
    }
    catch (error) {
        console.error(`Error creating auth user for member ${memberId}:`, error);
    }
});
/** GymEntra: member's join request just got approved. */
exports.notifyOnMembershipApproved = (0, firestore_1.onDocumentUpdated)({ document: 'tenant_memberships/{membershipId}', region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after)
        return;
    if (before.status === 'active' || after.status !== 'active')
        return;
    await sendPushToUser(after.userId, 'Üyeliğin onaylandı 🎉', `${after.tenantName} ailesine hoş geldin! Üyelik kartın artık hazır.`, { screen: 'member/card' });
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
        await sendPushToUser(after.memberId, 'Ödemen onaylandı ✓', `${amountLabel} tutarındaki ödemen onaylandı.`, {
            screen: 'member/payments',
        });
    }
    else if (after.status === 'rejected') {
        await sendPushToUser(after.memberId, 'Ödemen onaylanmadı', `${amountLabel} tutarındaki ödeme bildirimin reddedildi. Detay için salonla iletişime geç.`, { screen: 'member/payments' });
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
    await sendPushToUser(after.memberId, 'Yeni programın hazır 💪', `Antrenörün senin için "${after.name}" programını hazırladı.`, { screen: 'member/workout' });
});
/**
 * GymEntra: in-app account deletion (App Store Guideline 5.1.1(v), and
 * Google Play's equivalent data-deletion policy require this).
 *
 * Runs with the Admin SDK because the client is deliberately not allowed to
 * bulk-delete: Firestore rules block `delete` on measurements, workout_logs,
 * payments and checkins so history can't be rewritten by whoever is holding
 * the phone.
 *
 * Personal fitness data is deleted outright. Payment ledger entries are
 * ANONYMISED rather than deleted — they are the gym's own bookkeeping and
 * erasing them would corrupt the owner's records. `memberId` is kept so
 * totals still add up; the name/note that identify a person are stripped.
 *
 * Refuses to run for the last remaining admin of a gym, which would leave
 * that gym permanently unmanageable.
 */
exports.deleteMyAccount = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    }
    const db = admin.firestore();
    // Guard: don't strand a gym without an admin.
    const adminMemberships = await db
        .collection('tenant_memberships')
        .where('userId', '==', uid)
        .where('role', '==', 'admin')
        .where('status', '==', 'active')
        .get();
    for (const membership of adminMemberships.docs) {
        const tenantId = membership.data().tenantId;
        const otherAdmins = await db
            .collection('tenant_memberships')
            .where('tenantId', '==', tenantId)
            .where('role', '==', 'admin')
            .where('status', '==', 'active')
            .get();
        if (otherAdmins.size <= 1) {
            throw new https_1.HttpsError('failed-precondition', 'Bu salonun tek yöneticisisiniz. Hesabınızı silmeden önce başka bir yönetici atayın.');
        }
    }
    // Hard-delete: data that belongs to the person, not the business.
    const ownedCollections = [
        { name: 'tenant_memberships', field: 'userId' },
        { name: 'measurements', field: 'memberId' },
        { name: 'workout_logs', field: 'memberId' },
        { name: 'checkins', field: 'userId' },
        { name: 'push_tokens', field: 'userId' },
        { name: 'programs', field: 'memberId' },
    ];
    for (const { name, field } of ownedCollections) {
        const snap = await db.collection(name).where(field, '==', uid).get();
        // Batches cap at 500 writes; chunk so a long-standing member can't
        // exceed it.
        for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = db.batch();
            snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    }
    // Trainer-owned artefacts: calendar shares in either direction.
    for (const field of ['ownerTrainerId', 'viewerTrainerId']) {
        const snap = await db.collection('calendar_shares').where(field, '==', uid).get();
        for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = db.batch();
            snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    }
    // Anonymise: business records that must survive.
    const paymentsSnap = await db.collection('payments').where('memberId', '==', uid).get();
    for (let i = 0; i < paymentsSnap.docs.length; i += 400) {
        const batch = db.batch();
        paymentsSnap.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, {
            memberName: 'Silinmiş üye',
            note: admin.firestore.FieldValue.delete(),
            memberDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        }));
        await batch.commit();
    }
    // Cancel future PT sessions rather than deleting them — the trainer's
    // past calendar stays intact, and upcoming slots free up.
    const sessionsSnap = await db
        .collection('pt_sessions')
        .where('memberId', '==', uid)
        .where('date', '>=', new Date())
        .get();
    for (let i = 0; i < sessionsSnap.docs.length; i += 400) {
        const batch = db.batch();
        sessionsSnap.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, {
            status: 'cancelled',
            memberName: 'Silinmiş üye',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }));
        await batch.commit();
    }
    // Auth record last: if anything above throws, the user can retry.
    await admin.auth().deleteUser(uid);
    console.log(`Account deleted: ${uid}`);
    return { deleted: true };
});
/**
 * GymEntra: assigns the 6-digit front-desk check-in code when a membership is
 * created.
 *
 * This used to run on the client inside requestJoin(), which queried
 * tenant_memberships for collisions *before* the user was a member of that
 * gym. An empty result was allowed, but the moment a code actually collided
 * the query touched a document the user couldn't read and Firestore answered
 * permission-denied — so joining failed exactly in the rare case the retry
 * logic existed to handle.
 *
 * Here the Admin SDK bypasses rules, so the collision check is safe.
 */
exports.assignMembershipShortCode = (0, firestore_1.onDocumentCreated)({ document: 'tenant_memberships/{membershipId}', region: 'europe-west1' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    // Migrated and legacy documents already carry one.
    if (data.shortCode)
        return;
    const tenantId = data.tenantId;
    if (!tenantId)
        return;
    const db = admin.firestore();
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const clash = await db
            .collection('tenant_memberships')
            .where('tenantId', '==', tenantId)
            .where('shortCode', '==', code)
            .limit(1)
            .get();
        if (!clash.empty)
            continue;
        await snap.ref.update({ shortCode: code });
        console.log(`Short code ${code} assigned to ${snap.id}`);
        return;
    }
    // Five collisions in a 900k space means something is wrong with the
    // tenant's data, not bad luck — surface it rather than looping.
    console.error(`Could not allocate a unique short code for ${snap.id} in tenant ${tenantId}`);
});
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
    await sendPushToUser(promoted, 'Yerin açıldı 🎉', `"${after.name}" dersinde bekleme listesinden çıktın, yerin hazır.`, { screen: 'member/classes' });
    console.log(`Promoted ${promoted} from waitlist of class ${event.params.classId}`);
});
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
//# sourceMappingURL=index.js.map