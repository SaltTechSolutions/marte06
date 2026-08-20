import * as admin from 'firebase-admin';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { clearFirestore } from './helpers';

/**
 * Proves the harness itself works before any business-logic test is
 * written on top of it: the Admin SDK talks to the emulator (not
 * production), a plain write/read round-trips, and `clearFirestore`
 * actually clears. plan-eng-review Faz 0.1.
 */
describe('functions test harness', () => {
  beforeEach(async () => {
    await clearFirestore();
  });

  afterAll(async () => {
    await Promise.all(admin.apps.map((app) => app?.delete()));
  });

  it('is talking to the emulator, not production', () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();
  });

  it('round-trips a document through the Admin SDK', async () => {
    const ref = admin.firestore().collection('_smoke').doc('probe');
    await ref.set({ ok: true, n: 1 });
    const snap = await ref.get();
    expect(snap.exists).toBe(true);
    expect(snap.data()).toEqual({ ok: true, n: 1 });
  });

  it('clearFirestore actually clears between tests', async () => {
    // If the previous test's document survived, this collection would be
    // non-empty at the start of this one.
    const snap = await admin.firestore().collection('_smoke').get();
    expect(snap.empty).toBe(true);
  });
});
