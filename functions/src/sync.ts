import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

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

/**
 * GymEntra (PKG-8): keeps `trainer_busy_slots` — the privacy-stripped mirror
 * a browsing member reads to find a free time — in sync with `pt_sessions`.
 * See that collection's own rule comment for why it has to be a separate
 * doc rather than widening `pt_sessions` read access.
 */
export const syncTrainerBusySlots = onDocumentWritten(
  { document: 'pt_sessions/{sessionId}', region: 'europe-west1' },
  async (event) => {
    const after = event.data?.after;
    const slotRef = admin.firestore().doc(`trainer_busy_slots/${event.params.sessionId}`);
    if (!after?.exists) {
      await slotRef.delete();
      return;
    }
    const data = after.data()!;
    await slotRef.set({
      tenantId: data.tenantId,
      trainerId: data.trainerId,
      date: data.date,
      durationMinutes: data.durationMinutes,
      status: data.status,
    });
  },
);
