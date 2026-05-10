import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-marte-rules',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('members/member-a').set({
      name: 'Ada',
      surname: 'Admin',
      email: 'member@example.com',
      memberUid: 'member-uid',
    });
    await db.doc('members/member-b').set({
      name: 'Other',
      surname: 'Member',
      email: 'other@example.com',
      memberUid: 'other-uid',
    });
    await db.doc('assigned_packages/pkg-a').set({
      memberId: 'member-a',
      memberUid: 'member-uid',
      packageName: 'Yoga',
    });
    await db.doc('lessons/lesson-a').set({
      memberUids: ['member-uid'],
      memberIds: ['member-a'],
    });
    await db.doc('payments/payment-a').set({
      memberId: 'member-a',
      amount: 1000,
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore rules', () => {
  test('unauthenticated users cannot read protected collections', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(db.doc('members/member-a').get());
    await assertFails(db.doc('assigned_packages/pkg-a').get());
    await assertFails(db.doc('lessons/lesson-a').get());
    await assertFails(db.doc('payments/payment-a').get());
  });

  test('admin claim can read and write admin data', async () => {
    const db = testEnv.authenticatedContext('admin-uid', { admin: true }).firestore();

    await assertSucceeds(db.doc('members/member-a').get());
    await assertSucceeds(db.doc('payments/payment-a').update({ amount: 1250 }));
    await assertSucceeds(db.doc('settings/app').set({ logoPath: 'settings/logo.png' }));
  });

  test('member can read own profile, package, and lesson', async () => {
    const db = testEnv
      .authenticatedContext('member-uid', { email: 'member@example.com' })
      .firestore();

    await assertSucceeds(db.doc('members/member-a').get());
    await assertSucceeds(db.doc('assigned_packages/pkg-a').get());
    await assertSucceeds(db.doc('lessons/lesson-a').get());
  });

  test('member cannot read another member or write admin data', async () => {
    const db = testEnv
      .authenticatedContext('member-uid', { email: 'member@example.com' })
      .firestore();

    await assertFails(db.doc('members/member-b').get());
    await assertFails(db.doc('payments/payment-a').update({ amount: 1 }));
    await assertFails(db.doc('branches/branch-a').set({ name: 'Pilates' }));
  });
});
