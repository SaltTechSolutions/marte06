import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

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
      .where('roles', 'array-contains', 'admin')
      .where('status', '==', 'active')
      .get();

    for (const membership of adminMemberships.docs) {
      const tenantId = membership.data().tenantId as string;
      const otherAdmins = await db
        .collection('tenant_memberships')
        .where('tenantId', '==', tenantId)
        .where('roles', 'array-contains', 'admin')
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
    //
    // Shares MEMBER_OWNED_COLLECTIONS with `removeMemberFromTenant` so the two
    // cannot drift — the PKG-era collections (packages, credits,
    // entitlements, PT sessions) were added to the app long after this
    // function was written and had been silently missing from its list, which
    // left a deleted account's packages and bookings behind. Unlike the admin
    // path this is NOT tenant-scoped: the person is leaving entirely, so
    // every gym's copy goes.
    const ownedCollections: { name: string; field: string }[] = [
      ...MEMBER_OWNED_COLLECTIONS,
      { name: 'tenant_memberships', field: 'userId' },
      { name: 'push_tokens', field: 'userId' },
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
 * Every collection that belongs to one person inside one gym, with the field
 * naming them. Shared by the two removal paths so they can never drift into
 * cleaning up different sets — the PKG-era collections were added to the app
 * long after `deleteMyAccount` was written and had been silently missing
 * from its cascade.
 *
 * `push_tokens` is deliberately absent: it is device state keyed by the Expo
 * token, not gym data, and it re-registers itself on the next launch.
 */
const MEMBER_OWNED_COLLECTIONS: { name: string; field: string }[] = [
  { name: 'member_packages', field: 'memberId' },
  { name: 'member_credits', field: 'memberId' },
  { name: 'member_entitlements', field: 'memberId' },
  { name: 'pt_sessions', field: 'memberId' },
  { name: 'checkins', field: 'userId' },
  { name: 'programs', field: 'memberId' },
  { name: 'measurements', field: 'memberId' },
  { name: 'workout_logs', field: 'memberId' },
  { name: 'payments', field: 'memberId' },
];

async function deleteQueryBatched(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.get();
  // Batches cap at 500 writes; chunk so a long-standing member can't exceed it.
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = admin.firestore().batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/**
 * An admin removes a member from their gym, with that member's gym data.
 *
 * Server-side because rules cannot express it: the client would need delete
 * rights on eight collections' documents belonging to someone else, which is
 * exactly the authority we refuse to hand out. Rules keep
 * `tenant_memberships` delete closed; this callable is the only way through.
 *
 * Scoped to ONE gym on purpose. Every collection here carries `tenantId`, so
 * a member of two gyms keeps everything in the other one, and their Firebase
 * account is untouched — this removes a membership, it does not delete a
 * person.
 */
export const removeMemberFromTenant = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
  }

  const tenantId = String(request.data?.tenantId ?? '');
  const memberId = String(request.data?.memberId ?? '');
  if (!tenantId || !memberId) {
    throw new HttpsError('invalid-argument', 'Salon ve üye bilgisi gerekiyor.');
  }

  const db = admin.firestore();

  const callerSnap = await db.doc(`tenant_memberships/${tenantId}_${uid}`).get();
  const caller = callerSnap.data();
  const callerIsAdmin =
    callerSnap.exists && caller?.status === 'active' && (caller?.roles ?? []).includes('admin');
  if (!callerIsAdmin) {
    throw new HttpsError('permission-denied', 'Bu işlem için salon yöneticisi olmanız gerekiyor.');
  }

  const targetRef = db.doc(`tenant_memberships/${tenantId}_${memberId}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Bu üye salonda bulunamadı.');
  }
  const target = targetSnap.data()!;

  // Same guard `deleteMyAccount` applies: never leave a gym without an admin.
  // Rules cannot count remaining admins, so it has to live here.
  if ((target.roles ?? []).includes('admin')) {
    const admins = await db
      .collection('tenant_memberships')
      .where('tenantId', '==', tenantId)
      .where('roles', 'array-contains', 'admin')
      .where('status', '==', 'active')
      .get();
    if (admins.size <= 1) {
      throw new HttpsError(
        'failed-precondition',
        'Bu salonun tek yöneticisi. Silmeden önce başka bir yönetici atayın.',
      );
    }
  }

  let deleted = 0;
  for (const { name, field } of MEMBER_OWNED_COLLECTIONS) {
    deleted += await deleteQueryBatched(
      db.collection(name).where('tenantId', '==', tenantId).where(field, '==', memberId),
    );
  }

  // Last: while the membership exists the mirrors can still be rebuilt from
  // it, so removing it first would strand a half-cleaned member if a later
  // batch failed.
  await targetRef.delete();

  return { deleted };
});
