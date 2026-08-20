import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK to interact with Firebase services
admin.initializeApp();

/**
 * Looks up every registered device for a user and pushes to all of them via
 * Expo's push service. Best-effort: a user with no tokens (never opened the
 * app, denied permission, simulator-only) is a silent no-op, not an error.
 */
async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  const tokensSnap = await admin.firestore().collection('push_tokens').where('userId', '==', userId).get();
  if (tokensSnap.empty) return;

  const messages = tokensSnap.docs.map((tokenDoc) => ({
    to: tokenDoc.id,
    title,
    body,
    sound: 'default',
    ...(data ? { data } : {}),
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = (await response.json().catch(() => null)) as
    | { data?: { status?: string; details?: { error?: string } }[] }
    | null;
  console.log(`Push to ${userId} (${messages.length} device(s)):`, JSON.stringify(result));

  // Expo answers per message, in the order we sent them. A DeviceNotRegistered
  // error means the app was uninstalled or the token was revoked — keeping it
  // costs a wasted request on every future push and the row never expires on
  // its own, so drop it here.
  const tickets = result?.data ?? [];
  const dead = tickets
    .map((ticket, i) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokensSnap.docs[i] : null))
    .filter((doc): doc is (typeof tokensSnap.docs)[number] => doc != null);

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
export const setAdminClaim = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Verify the caller is an admin
    if (!request.auth?.token?.admin) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can grant admin access.',
      );
    }

    const { email, isAdmin } = request.data as { email: string; isAdmin: boolean };
    if (!email || typeof isAdmin !== 'boolean') {
      throw new HttpsError(
        'invalid-argument',
        'email (string) and isAdmin (boolean) are required.',
      );
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, { admin: isAdmin });
      return { message: `Admin claim ${isAdmin ? 'granted' : 'revoked'} for ${email}.` };
    } catch (error) {
      console.error('Error setting admin claim:', error);
      throw new HttpsError('internal', 'Failed to set admin claim.');
    }
  },
);

/**
 * One-time callable function to seed admin claims for the initial admin emails.
 * Should be called once during setup, then can be disabled or removed.
 * Can be called by any authenticated user whose email is in the ADMIN_EMAILS list.
 */
export const seedAdminClaims = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
      throw new HttpsError(
        'permission-denied',
        'Only designated admin emails can run the initial seed.',
      );
    }

    const results: string[] = [];
    for (const email of ADMIN_EMAILS) {
      try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        results.push(`✅ ${email}: admin claim set`);
      } catch (e) {
        results.push(`❌ ${email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { results };
  },
);

/**
 * A Cloud Function that triggers when a new member is created in Firestore.
 * It creates a corresponding user in Firebase Authentication and updates the
 * member's document with the new auth UID.
 */
export const createAuthUserOnNewMember = onDocumentCreated(
  {
    document: 'members/{memberId}',
    region: 'europe-west1',
  },
  async (event) => {
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
      } catch (e) {
        console.warn(`Could not generate password reset link for ${memberData.email}:`, e);
      }

      // Update the member's document with the new UID
      await snap.ref.update({
        memberUid: userRecord.uid,
        passwordResetRequired: true,
      });
    } catch (error) {
      console.error(`Error creating auth user for member ${memberId}:`, error);
    }
  },
);

/** GymEntra: member's join request just got approved. */
export const notifyOnMembershipApproved = onDocumentUpdated(
  { document: 'tenant_memberships/{membershipId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === 'active' || after.status !== 'active') return;

    await sendPushToUser(
      after.userId,
      'Üyeliğin onaylandı 🎉',
      `${after.tenantName} ailesine hoş geldin! Üyelik kartın artık hazır.`,
      { screen: 'member/card' },
    );
  },
);

/** GymEntra: a member-submitted payment notice was confirmed or rejected. */
export const notifyOnPaymentStatusChange = onDocumentUpdated(
  { document: 'payments/{paymentId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status !== 'pending' || after.status === 'pending') return;

    const amountLabel = `₺${Number(after.amount).toLocaleString('tr-TR')}`;
    if (after.status === 'confirmed') {
      await sendPushToUser(after.memberId, 'Ödemen onaylandı ✓', `${amountLabel} tutarındaki ödemen onaylandı.`, {
        screen: 'member/payments',
      });
    } else if (after.status === 'rejected') {
      await sendPushToUser(
        after.memberId,
        'Ödemen onaylanmadı',
        `${amountLabel} tutarındaki ödeme bildirimin reddedildi. Detay için salonla iletişime geç.`,
        { screen: 'member/payments' },
      );
    }
  },
);

/** GymEntra: a trainer just assigned (activated) a program for this member. */
export const notifyOnProgramAssigned = onDocumentUpdated(
  { document: 'programs/{programId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === 'active' || after.status !== 'active') return;

    await sendPushToUser(
      after.memberId,
      'Yeni programın hazır 💪',
      `Antrenörün senin için "${after.name}" programını hazırladı.`,
      { screen: 'member/workout' },
    );
  },
);

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
export const deleteMyAccount = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
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
      const tenantId = membership.data().tenantId as string;
      const otherAdmins = await db
        .collection('tenant_memberships')
        .where('tenantId', '==', tenantId)
        .where('role', '==', 'admin')
        .where('status', '==', 'active')
        .get();
      if (otherAdmins.size <= 1) {
        throw new HttpsError(
          'failed-precondition',
          'Bu salonun tek yöneticisisiniz. Hesabınızı silmeden önce başka bir yönetici atayın.',
        );
      }
    }

    // Hard-delete: data that belongs to the person, not the business.
    const ownedCollections: { name: string; field: string }[] = [
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
      paymentsSnap.docs.slice(i, i + 400).forEach((d) =>
        batch.update(d.ref, {
          memberName: 'Silinmiş üye',
          note: admin.firestore.FieldValue.delete(),
          memberDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      );
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
      sessionsSnap.docs.slice(i, i + 400).forEach((d) =>
        batch.update(d.ref, {
          status: 'cancelled',
          memberName: 'Silinmiş üye',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      );
      await batch.commit();
    }

    // Auth record last: if anything above throws, the user can retry.
    await admin.auth().deleteUser(uid);

    console.log(`Account deleted: ${uid}`);
    return { deleted: true };
  },
);

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
export const assignMembershipShortCode = onDocumentCreated(
  { document: 'tenant_memberships/{membershipId}', region: 'europe-west1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    // Migrated and legacy documents already carry one.
    if (data.shortCode) return;

    const tenantId = data.tenantId as string | undefined;
    if (!tenantId) return;

    const db = admin.firestore();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const clash = await db
        .collection('tenant_memberships')
        .where('tenantId', '==', tenantId)
        .where('shortCode', '==', code)
        .limit(1)
        .get();
      if (!clash.empty) continue;

      await snap.ref.update({ shortCode: code });
      console.log(`Short code ${code} assigned to ${snap.id}`);
      return;
    }
    // Five collisions in a 900k space means something is wrong with the
    // tenant's data, not bad luck — surface it rather than looping.
    console.error(`Could not allocate a unique short code for ${snap.id} in tenant ${tenantId}`);
  },
);

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
export const promoteFromClassWaitlist = onDocumentUpdated(
  { document: 'classes/{classId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const capacity = after.capacity as number | undefined;
    const booked: string[] = after.bookedUserIds ?? [];
    const waitlist: string[] = after.waitlistUserIds ?? [];
    if (typeof capacity !== 'number' || waitlist.length === 0) return;

    // Only react to a spot actually opening; ignore our own promotion write
    // and any unrelated edit, otherwise this retriggers itself.
    const beforeBooked: string[] = before.bookedUserIds ?? [];
    const freedUp = booked.length < beforeBooked.length;
    if (!freedUp || booked.length >= capacity) return;

    const promoted = waitlist[0];
    // A stale waitlist entry for someone already booked would otherwise
    // duplicate them.
    const nextBooked = booked.includes(promoted) ? booked : [...booked, promoted];

    await event.data!.after.ref.update({
      bookedUserIds: nextBooked,
      waitlistUserIds: waitlist.slice(1),
    });

    await sendPushToUser(
      promoted,
      'Yerin açıldı 🎉',
      `"${after.name}" dersinde bekleme listesinden çıktın, yerin hazır.`,
      { screen: 'member/classes' },
    );

    console.log(`Promoted ${promoted} from waitlist of class ${event.params.classId}`);
  },
);

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
export const syncActiveMemberCount = onDocumentWritten(
  { document: 'tenant_memberships/{membershipId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const tenantId = (after?.tenantId ?? before?.tenantId) as string | undefined;
    if (!tenantId) return;

    const countsAsMember = (d: FirebaseFirestore.DocumentData | undefined) => {
      if (!d || d.status !== 'active') return false;
      const roles: string[] = d.roles ?? (d.role ? [d.role] : []);
      return roles.includes('member');
    };

    // Nothing that affects the tally changed — skip the recount.
    if (countsAsMember(before) === countsAsMember(after)) return;

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
  },
);

/**
 * GymEntra (PKG-1): keeps `gym_packages.activeAssignmentCount` in sync with
 * how many `member_packages` actually point at it. Rules read this tally to
 * decide whether a package's content is still editable — rules cannot count
 * documents themselves, same reasoning as `syncActiveMemberCount` above.
 *
 * Counts `active` and `frozen` assignments as "in use" (a frozen package is
 * still sold, just paused); `expired`/`cancelled` free the slot.
 */
export const syncPackageAssignmentCount = onDocumentWritten(
  { document: 'member_packages/{assignmentId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const packageId = (after?.packageId ?? before?.packageId) as string | undefined;
    if (!packageId) return;

    const inUse = (d: FirebaseFirestore.DocumentData | undefined) => !!d && ['active', 'frozen'].includes(d.status);
    if (inUse(before) === inUse(after)) return;

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
  },
);

/**
 * GymEntra (PKG-2): rolls a membership package's recurring entitlement
 * (Platinium's quarterly bonus lessons, a quota'd group-class allowance)
 * into its next period.
 *
 * Runs daily rather than exactly at each credit's `expiresAt` — a day of
 * slop is fine here (screens compare `expiresAt` against "now" themselves,
 * per AGENTS.md's read-time-check discipline, so a credit already reads as
 * expired before this catches up) and daily keeps the read volume small
 * regardless of how many gyms are on the platform.
 *
 * Skips renewal once the underlying assignment itself is no longer active
 * (expired, cancelled, or frozen) — a lapsed membership doesn't keep
 * minting lesson credits.
 */
export const renewEntitlementCredits = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const dueSnap = await db
      .collection('member_credits')
      .where('source', '==', 'entitlement')
      .where('status', '==', 'active')
      .where('expiresAt', '<=', now)
      .get();

    if (dueSnap.empty) return;

    let renewed = 0;
    let skipped = 0;
    for (const creditDoc of dueSnap.docs) {
      const credit = creditDoc.data();
      const assignmentRef = db.doc(`member_packages/${credit.sourcePackageId}`);
      const assignmentSnap = await assignmentRef.get();
      const assignment = assignmentSnap.data();

      // Expire the old credit either way — it's done regardless of whether
      // a successor gets created.
      await creditDoc.ref.update({ status: 'expired' });

      if (!assignment || assignment.status !== 'active' || assignment.endsAt.toMillis() <= now.toMillis()) {
        skipped += 1;
        continue;
      }

      const entitlement = credit.kind === 'ptLesson' ? assignment.entitlements?.ptLessons : assignment.entitlements?.groupClasses;
      if (!entitlement?.count || !entitlement?.periodDays) {
        // The catalog content changed underneath an old assignment (shouldn't
        // happen — gym_packages locks while assigned — but an assignment
        // outlives that lock if the package was retired mid-term). Stop
        // quietly rather than crash the whole batch over one holder.
        skipped += 1;
        continue;
      }

      const nextExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + entitlement.periodDays * 86400000);
      await db.collection('member_credits').add({
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
      renewed += 1;
    }

    console.log(`Entitlement credits: ${renewed} renewed, ${skipped} skipped (${dueSnap.size} due)`);
  },
);

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
export const syncMemberEntitlements = onDocumentWritten(
  { document: 'member_packages/{assignmentId}', region: 'europe-west1' },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const tenantId = (after?.tenantId ?? before?.tenantId) as string | undefined;
    const memberId = (after?.memberId ?? before?.memberId) as string | undefined;
    if (!tenantId || !memberId) return;

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
  },
);

function addDaysMs(date: FirebaseFirestore.Timestamp, days: number): FirebaseFirestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(date.toMillis() + days * 86400000);
}

/**
 * GymEntra (PKG-6): notifies the member a swap is waiting on them.
 * `createPackageChangeRequest` never writes anything to `member_packages`
 * itself — this is purely "someone should look at this."
 */
export const notifyOnPackageChangeRequested = onDocumentCreated(
  { document: 'package_change_requests/{requestId}', region: 'europe-west1' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await sendPushToUser(
      data.memberId,
      'Paket teklifin var',
      `${data.proposedSummary?.packageName ?? 'Yeni paket'} için bir teklif bekliyor.`,
      { screen: 'member/index' },
    );
  },
);

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
export const applyPackageChange = onDocumentUpdated(
  { document: 'package_change_requests/{requestId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after || before.status === after.status) return;

    if (after.status === 'rejected') {
      await sendPushToUser(
        after.createdBy,
        'Paket teklifi reddedildi',
        `${after.memberName}, ${after.proposedSummary?.packageName ?? 'önerilen paketi'} kabul etmedi.`,
      );
      return;
    }
    if (after.status !== 'approved' || after.appliedAt) return;

    const db = admin.firestore();
    const requestRef = event.data!.after.ref;

    await db.runTransaction(async (tx) => {
      const proposedPkgRef = db.doc(`gym_packages/${after.proposedPackageId}`);
      const proposedPkgSnap = await tx.get(proposedPkgRef);
      if (!proposedPkgSnap.exists) throw new Error(`Proposed package ${after.proposedPackageId} no longer exists`);
      const proposedPkg = proposedPkgSnap.data()!;

      let currentSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (after.currentPackageAssignmentId) {
        currentSnap = await tx.get(db.doc(`member_packages/${after.currentPackageAssignmentId}`));
      }

      let promotion: FirebaseFirestore.DocumentData | null = null;
      let promotionRef: FirebaseFirestore.DocumentReference | null = null;
      if (after.proposedPromotionId) {
        promotionRef = db.doc(`promotions/${after.proposedPromotionId}`);
        const promoSnap = await tx.get(promotionRef);
        const now = admin.firestore.Timestamp.now();
        if (
          promoSnap.exists &&
          promoSnap.data()!.isActive &&
          promoSnap.data()!.startsAt.toMillis() <= now.toMillis() &&
          promoSnap.data()!.endsAt.toMillis() >= now.toMillis() &&
          (promoSnap.data()!.maxRedemptions == null || (promoSnap.data()!.redeemed ?? 0) < promoSnap.data()!.maxRedemptions)
        ) {
          promotion = promoSnap.data()!;
        } else {
          promotion = null; // expired/exhausted/deactivated since the offer was made — drop it, don't fail the swap
        }
      }

      const effectiveAt = after.effectiveAt as FirebaseFirestore.Timestamp;
      const bonusDays = promotion?.kind === 'bonusDays' ? promotion.value : 0;
      const bonusLessons = promotion?.kind === 'bonusLessons' ? promotion.value : 0;
      const finalPrice =
        promotion?.kind === 'percentDiscount'
          ? Math.max(0, Math.round(proposedPkg.price * (1 - promotion.value / 100)))
          : promotion?.kind === 'amountDiscount'
            ? Math.max(0, proposedPkg.price - promotion.value)
            : proposedPkg.price;
      const endsAt =
        proposedPkg.kind === 'membership'
          ? addDaysMs(effectiveAt, (proposedPkg.durationDays ?? 0) + bonusDays)
          : addDaysMs(effectiveAt, proposedPkg.lessonValidityDays ?? 0);

      // Cancel the holding being replaced, if it's still active — a pure
      // addition (no currentPackageAssignmentId) leaves nothing to cancel.
      if (currentSnap?.exists && currentSnap.data()!.status === 'active') {
        tx.update(currentSnap.ref, { status: 'cancelled' });
      }

      const newPackageRef = db.collection('member_packages').doc();
      tx.set(newPackageRef, {
        tenantId: after.tenantId,
        memberId: after.memberId,
        memberName: after.memberName,
        packageId: after.proposedPackageId,
        packageName: proposedPkg.name,
        kind: proposedPkg.kind,
        entitlements: proposedPkg.entitlements,
        ...(proposedPkg.freezePolicy ? { freezePolicy: proposedPkg.freezePolicy } : {}),
        listPrice: proposedPkg.price,
        finalPrice,
        ...(promotion ? { promotionId: after.proposedPromotionId, promotionName: promotion.name, bonusDays, bonusLessons } : {}),
        startsAt: effectiveAt,
        endsAt,
        frozenDays: 0,
        freezes: [],
        status: 'active',
        assignedAt: admin.firestore.Timestamp.now(),
        assignedBy: after.createdBy,
      });

      const addCredit = (kind: 'ptLesson' | 'groupClass', source: 'purchase' | 'entitlement', total: number, expiresAt: FirebaseFirestore.Timestamp) => {
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
        const gc = proposedPkg.entitlements?.groupClasses;
        if (gc && !gc.unlimited && gc.count && gc.periodDays) {
          addCredit('groupClass', 'entitlement', gc.count, addDaysMs(effectiveAt, gc.periodDays));
        }
        const pt = proposedPkg.entitlements?.ptLessons;
        if (pt?.count && pt.periodDays) {
          addCredit('ptLesson', 'entitlement', pt.count, addDaysMs(effectiveAt, pt.periodDays));
        }
      }

      if (promotion && promotionRef) {
        tx.update(promotionRef, { redeemed: (promotion.redeemed ?? 0) + 1 });
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
          note: `${after.currentSummary?.packageName ?? 'eski paket'} → ${proposedPkg.name} geçişi (${after.refundBasis ?? ''})`,
          createdAt: admin.firestore.Timestamp.now(),
          confirmedAt: admin.firestore.Timestamp.now(),
        });
      }

      tx.update(requestRef, { appliedAt: admin.firestore.Timestamp.now() });
    });

    console.log(`Package change ${event.params.requestId} applied for member ${after.memberId}`);
  },
);

/**
 * GymEntra (PKG-6): a proposal nobody answered doesn't stay pending forever
 * — an admin who forgot about it shouldn't find a stale offer months later.
 */
export const expirePendingPackageChangeRequests = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const dueSnap = await db
      .collection('package_change_requests')
      .where('status', '==', 'pending')
      .where('expiresAt', '<=', now)
      .get();
    if (dueSnap.empty) return;

    const batch = db.batch();
    dueSnap.docs.forEach((doc) => batch.update(doc.ref, { status: 'expired' }));
    await batch.commit();
    console.log(`${dueSnap.size} package change request(s) expired`);
  },
);
