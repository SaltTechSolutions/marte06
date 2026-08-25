import * as admin from 'firebase-admin';
import { beforeEach, describe, expect, it } from 'vitest';

import { reconcileMirrors } from '../src/sync';
import { clearFirestore, timestampDaysFromNow } from './helpers';

const TENANT = 't1';

function run() {
  return reconcileMirrors.run({} as never);
}

describe('reconcileMirrors', () => {
  beforeEach(async () => {
    await clearFirestore();
  });

  it('corrects a wrong tenants.activeMemberCount', async () => {
    await admin.firestore().doc(`tenants/${TENANT}`).set({ activeMemberCount: 99 });
    await admin.firestore().doc(`tenant_memberships/${TENANT}_m1`).set({ tenantId: TENANT, status: 'active', roles: ['member'] });
    await admin.firestore().doc(`tenant_memberships/${TENANT}_m2`).set({ tenantId: TENANT, status: 'active', roles: ['member'] });
    // A trainer must not count.
    await admin.firestore().doc(`tenant_memberships/${TENANT}_t1`).set({ tenantId: TENANT, status: 'active', roles: ['trainer'] });

    await run();

    const tenant = await admin.firestore().doc(`tenants/${TENANT}`).get();
    expect(tenant.data()?.activeMemberCount).toBe(2);
  });

  it('leaves a correct tenants.activeMemberCount untouched', async () => {
    await admin.firestore().doc(`tenants/${TENANT}`).set({ activeMemberCount: 1 });
    await admin.firestore().doc(`tenant_memberships/${TENANT}_m1`).set({ tenantId: TENANT, status: 'active', roles: ['member'] });

    await run();

    const tenant = await admin.firestore().doc(`tenants/${TENANT}`).get();
    expect(tenant.data()?.activeMemberCount).toBe(1);
  });

  it('corrects a wrong gym_packages.activeAssignmentCount', async () => {
    await admin.firestore().doc('gym_packages/pkg-1').set({ tenantId: TENANT, name: 'Gold', activeAssignmentCount: 0 });
    await admin.firestore().doc('member_packages/mp-1').set({ tenantId: TENANT, memberId: 'm1', packageId: 'pkg-1', status: 'active', kind: 'lessons' });
    await admin.firestore().doc('member_packages/mp-2').set({ tenantId: TENANT, memberId: 'm2', packageId: 'pkg-1', status: 'frozen', kind: 'lessons' });
    await admin.firestore().doc('member_packages/mp-3').set({ tenantId: TENANT, memberId: 'm3', packageId: 'pkg-1', status: 'cancelled', kind: 'lessons' });

    await run();

    const pkg = await admin.firestore().doc('gym_packages/pkg-1').get();
    expect(pkg.data()?.activeAssignmentCount).toBe(2); // active + frozen, not cancelled
  });

  it('corrects a wrong member_entitlements cache', async () => {
    const endsAt = timestampDaysFromNow(30);
    await admin.firestore().doc('member_packages/mp-1').set({
      tenantId: TENANT,
      memberId: 'm1',
      packageId: 'pkg-1',
      kind: 'membership',
      status: 'active',
      entitlements: { gymAccess: true, ptLessons: { count: 4, periodDays: 30 } },
      endsAt,
    });
    // Cache exists but is stale (wrong entitlements + wrong packageId).
    await admin.firestore().doc(`member_entitlements/${TENANT}_m1`).set({
      tenantId: TENANT,
      memberId: 'm1',
      packageId: 'some-other-package',
      entitlements: { gymAccess: false },
      endsAt: timestampDaysFromNow(1),
    });

    await run();

    const cache = await admin.firestore().doc(`member_entitlements/${TENANT}_m1`).get();
    expect(cache.data()).toMatchObject({
      packageId: 'mp-1',
      entitlements: { gymAccess: true, ptLessons: { count: 4, periodDays: 30 } },
    });
  });

  it('deletes an orphaned member_entitlements cache with no qualifying package', async () => {
    await admin.firestore().doc(`member_entitlements/${TENANT}_ghost`).set({
      tenantId: TENANT,
      memberId: 'ghost',
      packageId: 'nonexistent',
      entitlements: { gymAccess: true },
      endsAt: timestampDaysFromNow(30),
    });

    await run();

    const cache = await admin.firestore().doc(`member_entitlements/${TENANT}_ghost`).get();
    expect(cache.exists).toBe(false);
  });

  it('leaves a correct member_entitlements cache untouched', async () => {
    const endsAt = timestampDaysFromNow(30);
    const entitlements = { gymAccess: true };
    await admin.firestore().doc('member_packages/mp-1').set({
      tenantId: TENANT,
      memberId: 'm1',
      packageId: 'pkg-1',
      kind: 'membership',
      status: 'active',
      entitlements,
      endsAt,
    });
    await admin.firestore().doc(`member_entitlements/${TENANT}_m1`).set({
      tenantId: TENANT,
      memberId: 'm1',
      packageId: 'mp-1',
      entitlements,
      endsAt,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    const before = await admin.firestore().doc(`member_entitlements/${TENANT}_m1`).get();
    await run();
    const after = await admin.firestore().doc(`member_entitlements/${TENANT}_m1`).get();

    // Untouched: same updatedAt (a rewrite would have bumped it).
    expect(after.data()?.updatedAt.toMillis()).toBe(before.data()?.updatedAt.toMillis());
  });

  it('corrects a wrong trainer_busy_slots mirror', async () => {
    const date = timestampDaysFromNow(3);
    await admin.firestore().doc('pt_sessions/s1').set({
      tenantId: TENANT,
      trainerId: 'trainer1',
      memberId: 'm1',
      date,
      durationMinutes: 60,
      status: 'scheduled',
    });
    // Mirror is stale (wrong status).
    await admin.firestore().doc('trainer_busy_slots/s1').set({
      tenantId: TENANT,
      trainerId: 'trainer1',
      date,
      durationMinutes: 60,
      status: 'cancelled',
    });

    await run();

    const slot = await admin.firestore().doc('trainer_busy_slots/s1').get();
    expect(slot.data()?.status).toBe('scheduled');
  });

  it('deletes an orphaned trainer_busy_slots doc with no backing pt_sessions', async () => {
    await admin.firestore().doc('trainer_busy_slots/ghost-session').set({
      tenantId: TENANT,
      trainerId: 'trainer1',
      date: timestampDaysFromNow(3),
      durationMinutes: 60,
      status: 'scheduled',
    });

    await run();

    const slot = await admin.firestore().doc('trainer_busy_slots/ghost-session').get();
    expect(slot.exists).toBe(false);
  });

  it('creates a missing trainer_busy_slots mirror for an existing session', async () => {
    await admin.firestore().doc('pt_sessions/s2').set({
      tenantId: TENANT,
      trainerId: 'trainer1',
      memberId: 'm1',
      date: timestampDaysFromNow(3),
      durationMinutes: 45,
      status: 'scheduled',
    });

    await run();

    const slot = await admin.firestore().doc('trainer_busy_slots/s2').get();
    expect(slot.exists).toBe(true);
    expect(slot.data()).toMatchObject({ trainerId: 'trainer1', durationMinutes: 45, status: 'scheduled' });
  });
});
