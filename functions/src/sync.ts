import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
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

function timestampsEqual(a: FirebaseFirestore.Timestamp | undefined, b: FirebaseFirestore.Timestamp | undefined): boolean {
  if (!a || !b) return a === b;
  return a.toMillis() === b.toMillis();
}

/** Plain-value deep equality — every field these mirrors carry is a
 *  JSON-safe primitive or a nested object of them (no arrays, no
 *  Timestamps inside nested objects), so this doesn't need to be general. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
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
export const reconcileMirrors = onSchedule(
  { schedule: 'every monday 03:00', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
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
      if ((tenantDoc.data().activeMemberCount ?? 0) !== trueCount) {
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
      if ((pkgDoc.data().activeAssignmentCount ?? 0) !== trueCount) {
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
    const byMember = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const d of allPackagesSnap.docs) {
      const data = d.data();
      const key = `${data.tenantId}_${data.memberId}`;
      const existing = byMember.get(key);
      if (existing) existing.push(d);
      else byMember.set(key, [d]);
    }

    const now = admin.firestore.Timestamp.now();
    const seenEntitlementKeys = new Set<string>();
    for (const [key, docs] of byMember) {
      checked += 1;
      seenEntitlementKeys.add(key);
      const current = docs
        .filter((d) => {
          const p = d.data();
          return p.kind === 'membership' && p.status === 'active' && (p.endsAt as FirebaseFirestore.Timestamp).toMillis() >= now.toMillis();
        })
        .sort((a, b) => (b.data().endsAt as FirebaseFirestore.Timestamp).toMillis() - (a.data().endsAt as FirebaseFirestore.Timestamp).toMillis())[0];

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
      const matches =
        !!cached &&
        cached.packageId === current.id &&
        deepEqual(cached.entitlements, currentData.entitlements) &&
        timestampsEqual(cached.endsAt as FirebaseFirestore.Timestamp | undefined, currentData.endsAt as FirebaseFirestore.Timestamp);
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
    const seenSlotIds = new Set<string>();
    for (const d of sessionsSnap.docs) {
      checked += 1;
      seenSlotIds.add(d.id);
      const data = d.data();
      const expected = {
        tenantId: data.tenantId,
        trainerId: data.trainerId,
        date: data.date as FirebaseFirestore.Timestamp,
        durationMinutes: data.durationMinutes,
        status: data.status,
      };
      const cached = slotByKey.get(d.id);
      const matches =
        !!cached &&
        cached.tenantId === expected.tenantId &&
        cached.trainerId === expected.trainerId &&
        timestampsEqual(cached.date as FirebaseFirestore.Timestamp | undefined, expected.date) &&
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
  },
);
