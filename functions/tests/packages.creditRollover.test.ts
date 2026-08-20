import * as admin from 'firebase-admin';
import { beforeEach, describe, expect, it } from 'vitest';

import { creditRollover } from '../src/packages';
import { clearFirestore, timestampDaysFromNow } from './helpers';

const TENANT = 't1';

async function seedActiveMembershipAssignment(memberId: string) {
  const ref = admin.firestore().collection('member_packages').doc(`${memberId}_pkg`);
  await ref.set({
    tenantId: TENANT,
    memberId,
    packageName: 'Platinium',
    kind: 'membership',
    entitlements: { gymAccess: true, ptLessons: { count: 12, periodDays: 90 } },
    status: 'active',
    endsAt: timestampDaysFromNow(60),
  });
  return ref;
}

describe('creditRollover', () => {
  beforeEach(async () => {
    await clearFirestore();
  });

  it(
    // Regression (Faz 1.2): the old job only ever queried status=='active',
    // so a credit the member had just spent down to 'exhausted' (e.g. by
    // booking their last PT session) stopped renewing forever.
    'renews an exhausted entitlement credit, not just an active one',
    async () => {
      await seedActiveMembershipAssignment('m1');
      const creditRef = admin.firestore().collection('member_credits').doc('credit-1');
      await creditRef.set({
        tenantId: TENANT,
        memberId: 'm1',
        kind: 'ptLesson',
        source: 'entitlement',
        sourcePackageId: 'm1_pkg',
        total: 12,
        used: 12, // fully spent
        status: 'exhausted',
        expiresAt: timestampDaysFromNow(-1), // past due
      });

      await creditRollover.run({} as never);

      const expired = await creditRef.get();
      expect(expired.data()?.status).toBe('expired');

      const successor = await admin.firestore().collection('member_credits').doc('credit-1_next').get();
      expect(successor.exists).toBe(true);
      expect(successor.data()).toMatchObject({ status: 'active', used: 0, total: 12, source: 'entitlement' });
    },
  );

  it(
    // Faz 1.3: the successor's id is deterministic, so a redelivered /
    // manually rerun invocation must not mint a second credit for the
    // same source.
    'is idempotent — running twice does not double-mint the successor',
    async () => {
      await seedActiveMembershipAssignment('m1');
      const creditRef = admin.firestore().collection('member_credits').doc('credit-1');
      await creditRef.set({
        tenantId: TENANT,
        memberId: 'm1',
        kind: 'ptLesson',
        source: 'entitlement',
        sourcePackageId: 'm1_pkg',
        total: 12,
        used: 0,
        status: 'active',
        expiresAt: timestampDaysFromNow(-1),
      });

      await creditRollover.run({} as never);
      await creditRollover.run({} as never);

      // Second run finds credit-1 already 'expired' (not active/exhausted),
      // so the query no longer picks it up — the successor is written once.
      const snap = await admin.firestore().collection('member_credits').where('sourcePackageId', '==', 'm1_pkg').get();
      expect(snap.size).toBe(2); // the original (now expired) + one successor
    },
  );

  it('lets a purchased (non-entitlement) credit expire without minting a successor', async () => {
    const creditRef = admin.firestore().collection('member_credits').doc('credit-2');
    await creditRef.set({
      tenantId: TENANT,
      memberId: 'm2',
      kind: 'ptLesson',
      source: 'purchase',
      sourcePackageId: 'catalog-x',
      total: 5,
      used: 3,
      status: 'active',
      expiresAt: timestampDaysFromNow(-1),
    });

    await creditRollover.run({} as never);

    const expired = await creditRef.get();
    expect(expired.data()?.status).toBe('expired');
    const successor = await admin.firestore().collection('member_credits').doc('credit-2_next').get();
    expect(successor.exists).toBe(false);
  });

  it('skips renewal when the underlying membership is no longer active', async () => {
    const assignmentRef = admin.firestore().collection('member_packages').doc('m3_pkg');
    await assignmentRef.set({
      tenantId: TENANT,
      memberId: 'm3',
      packageName: 'Platinium',
      kind: 'membership',
      entitlements: { gymAccess: true, ptLessons: { count: 12, periodDays: 90 } },
      status: 'cancelled',
      endsAt: timestampDaysFromNow(60),
    });
    const creditRef = admin.firestore().collection('member_credits').doc('credit-3');
    await creditRef.set({
      tenantId: TENANT,
      memberId: 'm3',
      kind: 'ptLesson',
      source: 'entitlement',
      sourcePackageId: 'm3_pkg',
      total: 12,
      used: 2,
      status: 'active',
      expiresAt: timestampDaysFromNow(-1),
    });

    await creditRollover.run({} as never);

    const expired = await creditRef.get();
    expect(expired.data()?.status).toBe('expired');
    const successor = await admin.firestore().collection('member_credits').doc('credit-3_next').get();
    expect(successor.exists).toBe(false);
  });

  it('leaves credits that are not yet due untouched', async () => {
    const creditRef = admin.firestore().collection('member_credits').doc('credit-4');
    await creditRef.set({
      tenantId: TENANT,
      memberId: 'm4',
      kind: 'ptLesson',
      source: 'entitlement',
      sourcePackageId: 'm4_pkg',
      total: 12,
      used: 0,
      status: 'active',
      expiresAt: timestampDaysFromNow(30),
    });

    await creditRollover.run({} as never);

    const untouched = await creditRef.get();
    expect(untouched.data()?.status).toBe('active');
  });
});
