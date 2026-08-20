import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it } from 'vitest';

import { bookPtSessions } from '../src/sessions';
import { clearFirestore, timestampDaysFromNow } from './helpers';

const TENANT = 't1';
const TRAINER = 'trainer1';
const MEMBER = 'member1';

async function seedMember(uid = MEMBER, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`tenant_memberships/${TENANT}_${uid}`)
    .set({ tenantId: TENANT, userId: uid, status: 'active', roles: ['member'], userDisplayName: 'Test Üye', ...overrides });
}

async function seedTrainer(uid = TRAINER, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`tenant_memberships/${TENANT}_${uid}`)
    .set({ tenantId: TENANT, userId: uid, status: 'active', roles: ['trainer'], userDisplayName: 'Test Antrenör', ...overrides });
}

async function seedAvailability(overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .doc(`trainer_availability/${TENANT}_${TRAINER}`)
    .set({
      tenantId: TENANT,
      trainerId: TRAINER,
      weekly: { mon: [{ start: '09:00', end: '12:00' }], tue: [{ start: '09:00', end: '12:00' }], wed: [{ start: '09:00', end: '12:00' }] },
      slotMinutes: 60,
      exceptions: [],
      ...overrides,
    });
}

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
      used: 0,
      status: 'active',
      expiresAt: timestampDaysFromNow(30),
      ...overrides,
    });
}

/** The next occurrence of a specific weekday at a given hour, always in the future. */
function nextWeekdayAt(targetDay: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== targetDay) d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const NEXT_MONDAY_10AM = () => nextWeekdayAt(1, 10);

function callAs(uid: string, data: Record<string, unknown>) {
  return bookPtSessions.run({ auth: { uid }, data } as never);
}

describe('bookPtSessions', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedMember();
    await seedTrainer();
    await seedAvailability();
    await seedCredit('credit-1');
  });

  it('books a valid slot and spends one credit', async () => {
    const slot = NEXT_MONDAY_10AM();
    const result = await callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] });
    expect(result).toEqual({ booked: 1 });

    const sessionSnap = await admin.firestore().doc(`pt_sessions/${TENANT}_${TRAINER}_${slot.getTime()}`).get();
    expect(sessionSnap.exists).toBe(true);
    expect(sessionSnap.data()).toMatchObject({ status: 'scheduled', memberId: MEMBER, creditId: 'credit-1' });

    const creditSnap = await admin.firestore().doc('member_credits/credit-1').get();
    expect(creditSnap.data()?.used).toBe(1);
  });

  it(
    // Faz 1.5 concurrency guarantee: two bookings racing for the same slot
    // must not both succeed. A query-then-auto-ID-write couldn't promise
    // this; a shared read on the deterministic doc can.
    'rejects a second booking for the same slot',
    async () => {
      const slot = NEXT_MONDAY_10AM();
      await callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] });
      await seedCredit('credit-2');

      await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    },
  );

  it('allows re-booking a slot whose prior session was cancelled', async () => {
    const slot = NEXT_MONDAY_10AM();
    await admin
      .firestore()
      .doc(`pt_sessions/${TENANT}_${TRAINER}_${slot.getTime()}`)
      .set({ tenantId: TENANT, trainerId: TRAINER, memberId: 'someone-else', status: 'cancelled', date: admin.firestore.Timestamp.fromDate(slot) });

    const result = await callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] });
    expect(result).toEqual({ booked: 1 });
  });

  describe('slot grid validation (Faz 1.7)', () => {
    it('rejects a slot misaligned with the availability grid', async () => {
      const misaligned = NEXT_MONDAY_10AM();
      misaligned.setMinutes(30); // window is 09:00-12:00 at 60-minute slots; 10:30 doesn't land on the grid
      await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [misaligned.toISOString()] })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    });

    it('rejects a slot that would run past the end of the window', async () => {
      const nearClose = nextWeekdayAt(1, 11);
      nearClose.setMinutes(30); // 11:30 + 60min = 12:30, past the 12:00 close
      await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [nearClose.toISOString()] })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    });

    it('rejects a duplicate slot within the same request', async () => {
      const slot = NEXT_MONDAY_10AM();
      await expect(
        callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString(), slot.toISOString()] }),
      ).rejects.toThrow(expect.objectContaining({ code: 'invalid-argument' }) as unknown as HttpsError);
    });
  });

  describe('trainer authorization (Faz 1.8)', () => {
    it('rejects booking a trainer whose membership is no longer active', async () => {
      await seedTrainer(TRAINER, { status: 'left' });
      const slot = NEXT_MONDAY_10AM();
      await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    });

    it('rejects booking a user who holds no trainer role', async () => {
      await seedTrainer(TRAINER, { roles: ['member'] });
      const slot = NEXT_MONDAY_10AM();
      await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    });
  });

  describe('credit validity chain (Faz 1.4)', () => {
    it('rejects booking with only an expired credit available', async () => {
      await admin.firestore().doc('member_credits/credit-1').update({ expiresAt: timestampDaysFromNow(-1) });
      const slot = NEXT_MONDAY_10AM();
      await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    });

    it('will not spend a credit on a slot that falls after the credit itself expires', async () => {
      // credit-1 expires in 2 days; the requested slot is two weeks out —
      // still on a valid grid slot (Monday 10:00), just past the credit's
      // own expiry.
      await admin.firestore().doc('member_credits/credit-1').update({ expiresAt: timestampDaysFromNow(2) });
      const slot = NEXT_MONDAY_10AM();
      slot.setDate(slot.getDate() + 14);

      await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] })).rejects.toThrow(
        expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
      );
    });

    it('spends the earliest-expiring eligible credit first', async () => {
      await admin.firestore().doc('member_credits/credit-1').update({ expiresAt: timestampDaysFromNow(60) });
      await seedCredit('credit-2', { expiresAt: timestampDaysFromNow(10) });

      const slot = NEXT_MONDAY_10AM();
      await callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] });

      const c1 = await admin.firestore().doc('member_credits/credit-1').get();
      const c2 = await admin.firestore().doc('member_credits/credit-2').get();
      expect(c1.data()?.used).toBe(0);
      expect(c2.data()?.used).toBe(1);
    });
  });

  it('rejects a member with no active membership', async () => {
    await seedMember(MEMBER, { status: 'left' });
    const slot = NEXT_MONDAY_10AM();
    await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [slot.toISOString()] })).rejects.toThrow(
      expect.objectContaining({ code: 'failed-precondition' }) as unknown as HttpsError,
    );
  });

  it('rejects a past slot', async () => {
    const past = new Date(Date.now() - 86400000);
    await expect(callAs(MEMBER, { tenantId: TENANT, trainerId: TRAINER, slots: [past.toISOString()] })).rejects.toThrow(
      expect.objectContaining({ code: 'invalid-argument' }) as unknown as HttpsError,
    );
  });
});
