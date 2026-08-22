import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it } from 'vitest';

import { cancelPtSession } from '../src/sessions';
import { clearFirestore, timestampDaysFromNow } from './helpers';

const TENANT = 't1';
const TRAINER = 'trainer1';
const MEMBER = 'member1';
const ADMIN = 'admin1';

async function seedCredit(id: string, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`member_credits/${id}`)
    .set({
      tenantId: TENANT,
      memberId: MEMBER,
      kind: 'ptLesson',
      source: 'purchase',
      sourcePackageId: 'pkg-1',
      total: 5,
      used: 1,
      status: 'active',
      expiresAt: timestampDaysFromNow(30),
      ...overrides,
    });
}

async function seedSession(id: string, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`pt_sessions/${id}`)
    .set({
      tenantId: TENANT,
      trainerId: TRAINER,
      memberId: MEMBER,
      status: 'scheduled',
      date: timestampDaysFromNow(10),
      durationMinutes: 60,
      ...overrides,
    });
}

async function seedAdminMembership() {
  await admin.firestore().doc(`tenant_memberships/${TENANT}_${ADMIN}`).set({
    tenantId: TENANT,
    userId: ADMIN,
    status: 'active',
    roles: ['admin'],
  });
}

function callAs(uid: string, data: Record<string, unknown>) {
  return cancelPtSession.run({ auth: { uid }, data } as never);
}

describe('cancelPtSession', () => {
  beforeEach(async () => {
    await clearFirestore();
  });

  it('member cancelling ≥ cancellationHours before the session refunds the credit', async () => {
    await seedCredit('credit-1', { used: 1 });
    await seedSession('sess-1', { creditId: 'credit-1', date: timestampDaysFromNow(10) });

    const result = await callAs(MEMBER, { sessionId: 'sess-1' });
    expect(result).toEqual({ refunded: true });

    const credit = await admin.firestore().doc('member_credits/credit-1').get();
    expect(credit.data()?.used).toBe(0);
    const session = await admin.firestore().doc('pt_sessions/sess-1').get();
    expect(session.data()?.status).toBe('cancelled');
  });

  it(
    // Faz 1.9 core policy: cancelling too late burns the credit — this is
    // exactly what the member sees a warning about before confirming.
    'member cancelling within cancellationHours of the session does NOT refund the credit',
    async () => {
      await seedCredit('credit-2', { used: 1 });
      const soon = admin.firestore.Timestamp.fromMillis(Date.now() + 3 * 3600000); // 3 hours out
      await seedSession('sess-2', { creditId: 'credit-2', date: soon });

      const result = await callAs(MEMBER, { sessionId: 'sess-2' });
      expect(result).toEqual({ refunded: false });

      const credit = await admin.firestore().doc('member_credits/credit-2').get();
      expect(credit.data()?.used).toBe(1);
      const session = await admin.firestore().doc('pt_sessions/sess-2').get();
      expect(session.data()?.status).toBe('cancelled');
    },
  );

  it('respects a tenant-configured cancellationHours instead of the 24h default', async () => {
    await admin.firestore().doc(`tenants/${TENANT}`).set({ cancellationHours: 48 });
    await seedCredit('credit-3', { used: 1 });
    // 30 hours out — refunds under the 24h default, but not under 48h.
    const thirtyHoursOut = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 3600000);
    await seedSession('sess-3', { creditId: 'credit-3', date: thirtyHoursOut });

    const result = await callAs(MEMBER, { sessionId: 'sess-3' });
    expect(result).toEqual({ refunded: false });
  });

  it('un-exhausts a credit that the cancelled session had fully spent', async () => {
    await seedCredit('credit-4', { total: 1, used: 1, status: 'exhausted' });
    await seedSession('sess-4', { creditId: 'credit-4', date: timestampDaysFromNow(10) });

    await callAs(MEMBER, { sessionId: 'sess-4' });

    const credit = await admin.firestore().doc('member_credits/credit-4').get();
    expect(credit.data()).toMatchObject({ used: 0, status: 'active' });
  });

  it('trainer cancelling always refunds, regardless of timing', async () => {
    await seedCredit('credit-5', { used: 1 });
    const soon = admin.firestore.Timestamp.fromMillis(Date.now() + 3600000); // 1 hour out
    await seedSession('sess-5', { creditId: 'credit-5', date: soon });

    const result = await callAs(TRAINER, { sessionId: 'sess-5' });
    expect(result).toEqual({ refunded: true });
  });

  it('admin cancelling always refunds, regardless of timing', async () => {
    await seedAdminMembership();
    await seedCredit('credit-6', { used: 1 });
    const soon = admin.firestore.Timestamp.fromMillis(Date.now() + 3600000);
    await seedSession('sess-6', { creditId: 'credit-6', date: soon });

    const result = await callAs(ADMIN, { sessionId: 'sess-6' });
    expect(result).toEqual({ refunded: true });
  });

  it('cancelling a session with no creditId (trainer\'s own booking) succeeds with no refund decision', async () => {
    await seedSession('sess-7');
    const result = await callAs(TRAINER, { sessionId: 'sess-7' });
    expect(result).toEqual({ refunded: false });
    const session = await admin.firestore().doc('pt_sessions/sess-7').get();
    expect(session.data()?.status).toBe('cancelled');
  });

  it('rejects a stranger who is neither the member, the trainer, nor an admin', async () => {
    await seedSession('sess-8');
    await expect(callAs('someone-else', { sessionId: 'sess-8' })).rejects.toThrow(
      expect.objectContaining({ code: 'permission-denied' }) as unknown as HttpsError,
    );
  });

  it('rejects cancelling an already-cancelled session', async () => {
    await seedSession('sess-9', { status: 'cancelled' });
    await expect(callAs(MEMBER, { sessionId: 'sess-9' })).rejects.toThrow(
      expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
    );
  });

  it('rejects cancelling a completed session', async () => {
    await seedSession('sess-10', { status: 'completed' });
    await expect(callAs(MEMBER, { sessionId: 'sess-10' })).rejects.toThrow(
      expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
    );
  });
});
