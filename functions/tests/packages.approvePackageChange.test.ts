import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it } from 'vitest';

import { approvePackageChange } from '../src/packages';
import { clearFirestore, timestampDaysFromNow } from './helpers';

const TENANT = 't1';
const MEMBER = 'member1';
const ADMIN = 'admin1';

async function seedGymPackage(id: string, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`gym_packages/${id}`)
    .set({
      tenantId: TENANT,
      name: 'Gold',
      kind: 'membership',
      price: 1000,
      durationDays: 30,
      entitlements: { gymAccess: true },
      ...overrides,
    });
}

async function seedCurrentAssignment(id: string, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`member_packages/${id}`)
    .set({
      tenantId: TENANT,
      memberId: MEMBER,
      memberName: 'Test Üye',
      packageName: 'Silver',
      kind: 'membership',
      entitlements: { gymAccess: true },
      listPrice: 500,
      finalPrice: 500,
      startsAt: timestampDaysFromNow(-10),
      endsAt: timestampDaysFromNow(20),
      status: 'active',
      ...overrides,
    });
}

async function seedRequest(id: string, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`package_change_requests/${id}`)
    .set({
      tenantId: TENANT,
      memberId: MEMBER,
      memberName: 'Test Üye',
      createdBy: ADMIN,
      kind: 'upgrade',
      proposedPackageId: 'pkg-gold',
      status: 'pending',
      effectiveAt: admin.firestore.Timestamp.now(),
      expiresAt: timestampDaysFromNow(3),
      ...overrides,
    });
}

function callAs(uid: string, data: Record<string, unknown>) {
  return approvePackageChange.run({ auth: { uid }, data } as never);
}

describe('approvePackageChange', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedGymPackage('pkg-gold');
  });

  it('approves a pure addition (no current assignment) and mints the new package', async () => {
    await seedRequest('req-1');

    const result = await callAs(MEMBER, { requestId: 'req-1', approve: true });
    expect(result).toMatchObject({ status: 'approved' });

    const reqSnap = await admin.firestore().doc('package_change_requests/req-1').get();
    expect(reqSnap.data()?.status).toBe('approved');
    expect(reqSnap.data()?.appliedAt).toBeTruthy();

    const pkgSnap = await admin.firestore().doc(`member_packages/${(result as { packageId: string }).packageId}`).get();
    expect(pkgSnap.data()).toMatchObject({ memberId: MEMBER, packageName: 'Gold', status: 'active' });
  });

  it('rejects when the member declines', async () => {
    await seedRequest('req-2');
    const result = await callAs(MEMBER, { requestId: 'req-2', approve: false });
    expect(result).toEqual({ status: 'rejected' });
    const reqSnap = await admin.firestore().doc('package_change_requests/req-2').get();
    expect(reqSnap.data()?.status).toBe('rejected');
  });

  it('a stranger cannot approve someone else\'s request', async () => {
    await seedRequest('req-3');
    await expect(callAs('someone-else', { requestId: 'req-3', approve: true })).rejects.toThrow(
      expect.objectContaining({ code: 'permission-denied' }) as unknown as HttpsError,
    );
  });

  it('rejects approving a request that already has a response', async () => {
    await seedRequest('req-4', { status: 'approved' });
    await expect(callAs(MEMBER, { requestId: 'req-4', approve: true })).rejects.toThrow(
      expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
    );
  });

  describe('replacing an existing holding', () => {
    it('cancels the old package and its credits, creates the new package', async () => {
      await seedCurrentAssignment('old-pkg');
      await admin.firestore().doc('member_credits/old-credit').set({
        tenantId: TENANT,
        memberId: MEMBER,
        kind: 'ptLesson',
        source: 'entitlement',
        sourcePackageId: 'old-pkg',
        total: 4,
        used: 1,
        status: 'active',
        expiresAt: timestampDaysFromNow(20),
      });
      await seedRequest('req-5', { currentPackageAssignmentId: 'old-pkg' });

      await callAs(MEMBER, { requestId: 'req-5', approve: true });

      const oldPkg = await admin.firestore().doc('member_packages/old-pkg').get();
      expect(oldPkg.data()?.status).toBe('cancelled');
      const oldCredit = await admin.firestore().doc('member_credits/old-credit').get();
      expect(oldCredit.data()?.status).toBe('cancelled');
    });

    it(
      // Codex #8: a second request targeting an assignment some other
      // approval already cancelled must fail loudly, not mint a duplicate
      // active package.
      'rejects a second approval whose current assignment is no longer active',
      async () => {
        await seedCurrentAssignment('old-pkg');
        await seedRequest('req-6a', { currentPackageAssignmentId: 'old-pkg' });
        await seedRequest('req-6b', { currentPackageAssignmentId: 'old-pkg' });

        await callAs(MEMBER, { requestId: 'req-6a', approve: true });

        await expect(callAs(MEMBER, { requestId: 'req-6b', approve: true })).rejects.toThrow(
          expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
        );

        // Exactly one new active package exists, not two.
        const activeSnap = await admin
          .firestore()
          .collection('member_packages')
          .where('memberId', '==', MEMBER)
          .where('status', '==', 'active')
          .get();
        expect(activeSnap.size).toBe(1);
      },
    );

    it('rejects when the current assignment belongs to a different tenant', async () => {
      await seedCurrentAssignment('old-pkg', { tenantId: 'other-tenant' });
      await seedRequest('req-7', { currentPackageAssignmentId: 'old-pkg' });
      await expect(callAs(MEMBER, { requestId: 'req-7', approve: true })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    });
  });

  describe('promotion re-validation (Codex #10)', () => {
    it('applies the swap with the promotion when it is still valid', async () => {
      await admin.firestore().doc('promotions/promo-1').set({
        tenantId: TENANT,
        name: '%10 indirim',
        kind: 'percentDiscount',
        value: 10,
        isActive: true,
        startsAt: timestampDaysFromNow(-5),
        endsAt: timestampDaysFromNow(5),
        redeemed: 0,
      });
      await seedRequest('req-8', { proposedPromotionId: 'promo-1' });

      const result = await callAs(MEMBER, { requestId: 'req-8', approve: true });
      expect(result).toMatchObject({ status: 'approved' });

      const promo = await admin.firestore().doc('promotions/promo-1').get();
      expect(promo.data()?.redeemed).toBe(1);
    });

    it(
      // Cross-model tension resolved in favor of Codex: refuse the whole
      // swap rather than silently applying it at full price.
      'refuses the swap and marks the request expired when the promotion ran out before approval',
      async () => {
        await admin.firestore().doc('promotions/promo-2').set({
          tenantId: TENANT,
          name: 'Süresi geçmiş',
          kind: 'percentDiscount',
          value: 10,
          isActive: true,
          startsAt: timestampDaysFromNow(-30),
          endsAt: timestampDaysFromNow(-1), // expired
          redeemed: 0,
        });
        await seedRequest('req-9', { proposedPromotionId: 'promo-2' });

        const result = await callAs(MEMBER, { requestId: 'req-9', approve: true });
        expect(result).toEqual({ status: 'promotion-expired' });

        const reqSnap = await admin.firestore().doc('package_change_requests/req-9').get();
        expect(reqSnap.data()?.status).toBe('expired');

        // No package should have been created for this member.
        const pkgSnap = await admin.firestore().collection('member_packages').where('memberId', '==', MEMBER).get();
        expect(pkgSnap.empty).toBe(true);
      },
    );
  });
});
