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

describe('Tenants and tenant memberships', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('tenants/tarabya-marte').set({
        code: 'TARABYA-01',
        name: 'Tarabya Marte',
        ownerUid: 'owner-uid',
      });
      await db.doc('tenant_memberships/tarabya-marte_admin-member-uid').set({
        userId: 'admin-member-uid',
        tenantId: 'tarabya-marte',
        status: 'active',
        role: 'admin',
      });
    });
  });

  test('unauthenticated users cannot read tenants or memberships', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.doc('tenants/tarabya-marte').get());
    await assertFails(db.doc('tenant_memberships/tarabya-marte_admin-member-uid').get());
  });

  test('any signed-in user can look up a tenant by reading it', async () => {
    const db = testEnv.authenticatedContext('some-uid').firestore();
    await assertSucceeds(db.doc('tenants/tarabya-marte').get());
  });

  test('a user can create only their own pending member join request at the deterministic id', async () => {
    const db = testEnv.authenticatedContext('new-uid').firestore();

    await assertFails(
      db.doc('tenant_memberships/tarabya-marte_someone-else').set({
        userId: 'someone-else',
        tenantId: 'tarabya-marte',
        status: 'pending',
        role: 'member',
      }),
    );
    await assertFails(
      db.doc('tenant_memberships/tarabya-marte_new-uid').set({
        userId: 'new-uid',
        tenantId: 'tarabya-marte',
        status: 'active',
        role: 'member',
      }),
    );
    await assertSucceeds(
      db.doc('tenant_memberships/tarabya-marte_new-uid').set({
        userId: 'new-uid',
        tenantId: 'tarabya-marte',
        status: 'pending',
        role: 'member',
      }),
    );
  });

  test('only a tenant admin can approve a pending membership', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('tenant_memberships/tarabya-marte_pending-uid')
        .set({ userId: 'pending-uid', tenantId: 'tarabya-marte', status: 'pending', role: 'member' });
    });

    const memberDb = testEnv.authenticatedContext('pending-uid').firestore();
    await assertFails(
      memberDb.doc('tenant_memberships/tarabya-marte_pending-uid').update({ status: 'active' }),
    );

    const adminDb = testEnv.authenticatedContext('admin-member-uid').firestore();
    await assertSucceeds(
      adminDb.doc('tenant_memberships/tarabya-marte_pending-uid').update({ status: 'active' }),
    );
  });

  test('tenant admin can read pending requests for their tenant; a stranger cannot', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('tenant_memberships/tarabya-marte_pending-uid')
        .set({ userId: 'pending-uid', tenantId: 'tarabya-marte', status: 'pending', role: 'member' });
    });

    const adminDb = testEnv.authenticatedContext('admin-member-uid').firestore();
    await assertSucceeds(adminDb.doc('tenant_memberships/tarabya-marte_pending-uid').get());

    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(strangerDb.doc('tenant_memberships/tarabya-marte_pending-uid').get());
  });

  test('creating a tenant requires self-assigning as ownerUid, with a non-empty code and name', async () => {
    const db = testEnv.authenticatedContext('new-owner-uid').firestore();

    await assertFails(
      db.collection('tenants').add({ code: 'NEWGYM-01', name: 'New Gym', ownerUid: 'someone-else' }),
    );
    await assertFails(db.collection('tenants').add({ code: '', name: 'New Gym', ownerUid: 'new-owner-uid' }));
    await assertSucceeds(
      db.collection('tenants').add({ code: 'NEWGYM-01', name: 'New Gym', ownerUid: 'new-owner-uid' }),
    );
  });

  test('a tenant owner can self-grant its admin membership, but not for a tenant they do not own', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('tenants/new-gym')
        .set({ code: 'NEWGYM-01', name: 'New Gym', ownerUid: 'new-owner-uid' });
    });

    const ownerDb = testEnv.authenticatedContext('new-owner-uid').firestore();
    await assertSucceeds(
      ownerDb.doc('tenant_memberships/new-gym_new-owner-uid').set({
        userId: 'new-owner-uid',
        tenantId: 'new-gym',
        status: 'active',
        role: 'admin',
      }),
    );

    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(
      strangerDb.doc('tenant_memberships/new-gym_stranger-uid').set({
        userId: 'stranger-uid',
        tenantId: 'new-gym',
        status: 'active',
        role: 'admin',
      }),
    );
  });
});

describe('Classes', () => {
  /** PKG-4: the entitlement cache a member needs before they can book at all. */
  async function seedGroupClassEntitlement(uid: string, groupClasses: Record<string, unknown>, tenantId = 'tarabya-marte') {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`member_entitlements/${tenantId}_${uid}`).set({
        tenantId,
        memberId: uid,
        packageId: 'pkg-x',
        entitlements: { gymAccess: true, groupClasses },
        endsAt: new Date(Date.now() + 30 * 86400000),
        updatedAt: new Date(),
      });
    });
  }

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      // The root beforeEach clears Firestore before every test, so this
      // membership has to be seeded here — isTenantAdmin() reads it, and
      // without it every "admin can ..." assertion below is denied.
      await context.firestore().doc('tenant_memberships/tarabya-marte_admin-member-uid').set({
        userId: 'admin-member-uid',
        tenantId: 'tarabya-marte',
        status: 'active',
        role: 'admin',
      });
      await context.firestore().doc('classes/full-class').set({
        tenantId: 'tarabya-marte',
        name: 'Pilates',
        trainerName: 'Zeynep D.',
        capacity: 1,
        bookedUserIds: ['already-booked-uid'],
        waitlistUserIds: [],
      });
      await context.firestore().doc('classes/open-class').set({
        tenantId: 'tarabya-marte',
        name: 'HIIT',
        trainerName: 'Emre K.',
        capacity: 10,
        bookedUserIds: [],
        waitlistUserIds: [],
      });
    });
  });

  test('only a tenant admin can create a class', async () => {
    const memberDb = testEnv.authenticatedContext('some-member-uid').firestore();
    await assertFails(
      memberDb.collection('classes').add({ tenantId: 'tarabya-marte', name: 'Yoga', capacity: 5, bookedUserIds: [], waitlistUserIds: [] }),
    );

    const adminDb = testEnv.authenticatedContext('admin-member-uid').firestore();
    await assertSucceeds(
      adminDb.collection('classes').add({ tenantId: 'tarabya-marte', name: 'Yoga', capacity: 5, bookedUserIds: [], waitlistUserIds: [] }),
    );
  });

  test('a member with unlimited group-class entitlement can book an open class by adding only their own uid', async () => {
    await seedMembership('new-member-uid', 'member');
    await seedGroupClassEntitlement('new-member-uid', { unlimited: true });
    const db = testEnv.authenticatedContext('new-member-uid').firestore();
    await assertSucceeds(
      db.doc('classes/open-class').update({ bookedUserIds: ['new-member-uid'] }),
    );
    await assertFails(
      db.doc('classes/open-class').update({ bookedUserIds: ['new-member-uid', 'someone-else'] }),
    );
  });

  test('a member with no group-class entitlement cannot book at all (PKG-4)', async () => {
    await seedMembership('bare-member-uid', 'member');
    const db = testEnv.authenticatedContext('bare-member-uid').firestore();
    await assertFails(db.doc('classes/open-class').update({ bookedUserIds: ['bare-member-uid'] }));
    await assertFails(db.doc('classes/open-class').update({ waitlistUserIds: ['bare-member-uid'] }));
  });

  test('a quota\'d (non-unlimited) entitlement cannot book either — no consuming callable exists yet (PKG-4)', async () => {
    await seedMembership('quota-member-uid', 'member');
    await seedGroupClassEntitlement('quota-member-uid', { count: 4, periodDays: 30 });
    const db = testEnv.authenticatedContext('quota-member-uid').firestore();
    await assertFails(db.doc('classes/open-class').update({ bookedUserIds: ['quota-member-uid'] }));
  });

  test('an expired entitlement cache cannot book — endsAt is checked against request.time (PKG-4)', async () => {
    await seedMembership('lapsed-member-uid', 'member');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('member_entitlements/tarabya-marte_lapsed-member-uid').set({
        tenantId: 'tarabya-marte',
        memberId: 'lapsed-member-uid',
        packageId: 'pkg-x',
        entitlements: { gymAccess: true, groupClasses: { unlimited: true } },
        endsAt: new Date(Date.now() - 86400000), // yesterday
        updatedAt: new Date(),
      });
    });
    const db = testEnv.authenticatedContext('lapsed-member-uid').firestore();
    await assertFails(db.doc('classes/open-class').update({ bookedUserIds: ['lapsed-member-uid'] }));
  });

  test('a member cannot book past capacity — must join the waitlist instead', async () => {
    await seedMembership('new-member-uid', 'member');
    await seedGroupClassEntitlement('new-member-uid', { unlimited: true });
    const db = testEnv.authenticatedContext('new-member-uid').firestore();
    await assertFails(
      db.doc('classes/full-class').update({ bookedUserIds: ['already-booked-uid', 'new-member-uid'] }),
    );
    await assertSucceeds(
      db.doc('classes/full-class').update({ waitlistUserIds: ['new-member-uid'] }),
    );
  });

  test('a member can cancel their own booking even with no current entitlement — cancelling is never gated', async () => {
    await seedMembership('already-booked-uid', 'member');
    // Also a real member of the gym, so this asserts the "only your own uid"
    // invariant rather than passing merely because they are an outsider.
    await seedMembership('stranger-uid', 'member');

    const db = testEnv.authenticatedContext('already-booked-uid').firestore();
    await assertSucceeds(db.doc('classes/full-class').update({ bookedUserIds: [] }));

    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(strangerDb.doc('classes/full-class').update({ bookedUserIds: [] }));
  });

  test('a non-member cannot book a class even if they know its id', async () => {
    const db = testEnv.authenticatedContext('outsider-uid').firestore();
    await assertFails(db.doc('classes/open-class').update({ bookedUserIds: ['outsider-uid'] }));
  });

  test('a tenant admin can edit or delete any class for their tenant', async () => {
    const adminDb = testEnv.authenticatedContext('admin-member-uid').firestore();
    await assertSucceeds(adminDb.doc('classes/open-class').update({ capacity: 20 }));
    await assertSucceeds(adminDb.doc('classes/open-class').delete());
  });
});

describe('Check-ins', () => {
  test('only a tenant admin can record a check-in; a member cannot self-check-in', async () => {
    const memberDb = testEnv.authenticatedContext('some-member-uid').firestore();
    await assertFails(
      memberDb.collection('checkins').add({
        tenantId: 'tarabya-marte',
        userId: 'some-member-uid',
        membershipId: 'tarabya-marte_some-member-uid',
        accessReason: 'ok',
      }),
    );

    const adminDb = testEnv.authenticatedContext('admin-member-uid').firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('tenant_memberships/tarabya-marte_admin-member-uid').set({
        userId: 'admin-member-uid',
        tenantId: 'tarabya-marte',
        status: 'active',
        role: 'admin',
      });
    });
    await assertSucceeds(
      adminDb.collection('checkins').add({
        tenantId: 'tarabya-marte',
        userId: 'some-member-uid',
        membershipId: 'tarabya-marte_some-member-uid',
        accessReason: 'ok',
      }),
    );
  });

  test('check-ins are immutable and only readable by the tenant admin or the checked-in member', async () => {
    let checkinId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('tenant_memberships/tarabya-marte_admin-member-uid').set({
        userId: 'admin-member-uid',
        tenantId: 'tarabya-marte',
        status: 'active',
        role: 'admin',
      });
      const ref = await context.firestore().collection('checkins').add({
        tenantId: 'tarabya-marte',
        userId: 'some-member-uid',
        membershipId: 'tarabya-marte_some-member-uid',
        accessReason: 'ok',
      });
      checkinId = ref.id;
    });

    const adminDb = testEnv.authenticatedContext('admin-member-uid').firestore();
    await assertSucceeds(adminDb.doc(`checkins/${checkinId}`).get());
    await assertFails(adminDb.doc(`checkins/${checkinId}`).update({ userId: 'someone-else' }));

    const ownerDb = testEnv.authenticatedContext('some-member-uid').firestore();
    await assertSucceeds(ownerDb.doc(`checkins/${checkinId}`).get());

    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(strangerDb.doc(`checkins/${checkinId}`).get());
  });

  test('accessReason must be a known value (PKG-3)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('tenant_memberships/tarabya-marte_admin-member-uid').set({
        userId: 'admin-member-uid',
        tenantId: 'tarabya-marte',
        status: 'active',
        role: 'admin',
      });
    });
    const adminDb = testEnv.authenticatedContext('admin-member-uid').firestore();

    await assertFails(
      adminDb.collection('checkins').add({
        tenantId: 'tarabya-marte',
        userId: 'some-member-uid',
        membershipId: 'tarabya-marte_some-member-uid',
      }),
    );
    await assertFails(
      adminDb.collection('checkins').add({
        tenantId: 'tarabya-marte',
        userId: 'some-member-uid',
        membershipId: 'tarabya-marte_some-member-uid',
        accessReason: 'made-up-reason',
      }),
    );
    await assertSucceeds(
      adminDb.collection('checkins').add({
        tenantId: 'tarabya-marte',
        userId: 'some-member-uid',
        membershipId: 'tarabya-marte_some-member-uid',
        accessReason: 'frozen',
      }),
    );
  });
});

/**
 * Helpers for the GymEntra (multi-tenant) collections. Every one of these
 * rules hangs off a tenant_memberships lookup, so almost every test needs to
 * seed one first.
 */
const TENANT = 'tarabya-marte';
const OTHER_TENANT = 'other-gym';

async function seedMembership(
  uid: string,
  role: 'member' | 'trainer' | 'admin',
  tenantId = TENANT,
  status: 'active' | 'pending' | 'suspended' = 'active',
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`tenant_memberships/${tenantId}_${uid}`).set({
      userId: uid,
      tenantId,
      status,
      role,
    });
  });
}

describe('Tenant isolation — classes', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('classes/c1').set({
        tenantId: TENANT,
        name: 'Pilates',
        capacity: 10,
        bookedUserIds: ['booked-uid'],
        waitlistUserIds: [],
      });
    });
  });

  test('a member of the gym can read its classes', async () => {
    await seedMembership('member-1', 'member');
    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertSucceeds(db.doc('classes/c1').get());
  });

  test('a signed-in user with no membership cannot read another gym\'s classes', async () => {
    const db = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(db.doc('classes/c1').get());
  });

  test('a member of a DIFFERENT gym cannot read this gym\'s classes', async () => {
    await seedMembership('rival', 'admin', OTHER_TENANT);
    const db = testEnv.authenticatedContext('rival').firestore();
    await assertFails(db.doc('classes/c1').get());
  });

  test('a pending (not yet approved) member cannot read classes', async () => {
    await seedMembership('pending-1', 'member', TENANT, 'pending');
    const db = testEnv.authenticatedContext('pending-1').firestore();
    await assertFails(db.doc('classes/c1').get());
  });
});

describe('Cross-tenant injection — workout_logs, measurements, payments', () => {
  test('a member cannot write a workout log into a gym they do not belong to', async () => {
    await seedMembership('member-1', 'member', OTHER_TENANT);
    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(
      db.collection('workout_logs').add({
        tenantId: TENANT,
        memberId: 'member-1',
        programId: 'p1',
        exerciseLogs: [],
      }),
    );
  });

  test('a member can write a workout log into their own gym', async () => {
    await seedMembership('member-1', 'member');
    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertSucceeds(
      db.collection('workout_logs').add({
        tenantId: TENANT,
        memberId: 'member-1',
        programId: 'p1',
        exerciseLogs: [],
      }),
    );
  });

  test('a member cannot log a workout as somebody else', async () => {
    await seedMembership('member-1', 'member');
    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(
      db.collection('workout_logs').add({
        tenantId: TENANT,
        memberId: 'someone-else',
        programId: 'p1',
        exerciseLogs: [],
      }),
    );
  });

  test('a measurement must belong to the caller and to a gym they are in, with a sane weight', async () => {
    await seedMembership('member-1', 'member');
    const db = testEnv.authenticatedContext('member-1').firestore();

    await assertSucceeds(
      db.collection('measurements').add({ tenantId: TENANT, memberId: 'member-1', weightKg: 70 }),
    );
    await assertFails(
      db.collection('measurements').add({ tenantId: OTHER_TENANT, memberId: 'member-1', weightKg: 70 }),
    );
    await assertFails(
      db.collection('measurements').add({ tenantId: TENANT, memberId: 'member-1', weightKg: 0 }),
    );
    await assertFails(
      db.collection('measurements').add({ tenantId: TENANT, memberId: 'member-1', weightKg: 9999 }),
    );
  });

  test('measurements are append-only — nobody can edit or delete history', async () => {
    await seedMembership('member-1', 'member');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context
        .firestore()
        .collection('measurements')
        .add({ tenantId: TENANT, memberId: 'member-1', weightKg: 70 });
      id = ref.id;
    });

    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(db.doc(`measurements/${id}`).update({ weightKg: 60 }));
    await assertFails(db.doc(`measurements/${id}`).delete());
  });

  test('a member cannot spam a payment notice into a gym they do not belong to', async () => {
    await seedMembership('member-1', 'member', OTHER_TENANT);
    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(
      db.collection('payments').add({
        tenantId: TENANT,
        memberId: 'member-1',
        memberName: 'X',
        amount: 100,
        method: 'cash',
        status: 'pending',
      }),
    );
  });

  test('a member may only file a PENDING notice; never a confirmed one', async () => {
    await seedMembership('member-1', 'member');
    const db = testEnv.authenticatedContext('member-1').firestore();

    await assertSucceeds(
      db.collection('payments').add({
        tenantId: TENANT,
        memberId: 'member-1',
        memberName: 'X',
        amount: 100,
        method: 'cash',
        status: 'pending',
      }),
    );
    await assertFails(
      db.collection('payments').add({
        tenantId: TENANT,
        memberId: 'member-1',
        memberName: 'X',
        amount: 100,
        method: 'cash',
        status: 'confirmed',
      }),
    );
  });

  test('payment amount and method are validated', async () => {
    await seedMembership('member-1', 'member');
    const db = testEnv.authenticatedContext('member-1').firestore();
    const base = { tenantId: TENANT, memberId: 'member-1', memberName: 'X', status: 'pending' };

    await assertFails(db.collection('payments').add({ ...base, amount: 0, method: 'cash' }));
    await assertFails(db.collection('payments').add({ ...base, amount: -5, method: 'cash' }));
    await assertFails(db.collection('payments').add({ ...base, amount: 100, method: 'bitcoin' }));
  });

  test('a GymEntra payment can never be deleted, even by a global admin', async () => {
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('payments').add({
        tenantId: TENANT,
        memberId: 'member-1',
        amount: 100,
        method: 'cash',
        status: 'confirmed',
      });
      id = ref.id;
    });
    // The legacy marte06 block grants delete to the global admin claim; the
    // tenantId discriminator must stop it reaching GymEntra ledger rows.
    const globalAdminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    await assertFails(globalAdminDb.doc(`payments/${id}`).delete());
  });
});

describe('PT sessions', () => {
  test('a trainer can only book onto their OWN calendar', async () => {
    await seedMembership('trainer-1', 'trainer');
    await seedMembership('trainer-2', 'trainer');
    const db = testEnv.authenticatedContext('trainer-1').firestore();

    await assertSucceeds(
      db.collection('pt_sessions').add({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        memberId: 'member-1',
        status: 'scheduled',
      }),
    );
    await assertFails(
      db.collection('pt_sessions').add({
        tenantId: TENANT,
        trainerId: 'trainer-2',
        memberId: 'member-1',
        status: 'scheduled',
      }),
    );
  });

  test('the assigned trainer cannot move a session to another gym or swap the member', async () => {
    await seedMembership('trainer-1', 'trainer');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('pt_sessions').add({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        memberId: 'member-1',
        status: 'scheduled',
      });
      id = ref.id;
    });

    const db = testEnv.authenticatedContext('trainer-1').firestore();
    await assertSucceeds(db.doc(`pt_sessions/${id}`).update({ status: 'completed' }));
    await assertFails(db.doc(`pt_sessions/${id}`).update({ tenantId: OTHER_TENANT }));
    await assertFails(db.doc(`pt_sessions/${id}`).update({ memberId: 'someone-else' }));
  });

  test('a colleague may take over only WITH a calendar share, and only to themselves', async () => {
    await seedMembership('trainer-1', 'trainer');
    await seedMembership('trainer-2', 'trainer');
    await seedMembership('trainer-3', 'trainer');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('pt_sessions').add({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        trainerName: 'One',
        memberId: 'member-1',
        status: 'scheduled',
      });
      id = ref.id;
    });

    // No share yet — take-over must fail.
    const before = testEnv.authenticatedContext('trainer-2').firestore();
    await assertFails(
      before.doc(`pt_sessions/${id}`).update({ trainerId: 'trainer-2', trainerName: 'Two', originalTrainerId: 'trainer-1', updatedAt: new Date() }),
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`calendar_shares/${TENANT}_trainer-1_trainer-2`).set({
        tenantId: TENANT,
        ownerTrainerId: 'trainer-1',
        viewerTrainerId: 'trainer-2',
      });
    });

    const after = testEnv.authenticatedContext('trainer-2').firestore();
    await assertSucceeds(
      after.doc(`pt_sessions/${id}`).update({ trainerId: 'trainer-2', trainerName: 'Two', originalTrainerId: 'trainer-1', updatedAt: new Date() }),
    );
  });

  test('a shared-with colleague cannot hand the session to a THIRD trainer', async () => {
    await seedMembership('trainer-1', 'trainer');
    await seedMembership('trainer-2', 'trainer');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('pt_sessions').add({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        memberId: 'member-1',
        status: 'scheduled',
      });
      id = ref.id;
      await context.firestore().doc(`calendar_shares/${TENANT}_trainer-1_trainer-2`).set({
        tenantId: TENANT,
        ownerTrainerId: 'trainer-1',
        viewerTrainerId: 'trainer-2',
      });
    });

    const db = testEnv.authenticatedContext('trainer-2').firestore();
    await assertFails(
      db.doc(`pt_sessions/${id}`).update({ trainerId: 'trainer-3', trainerName: 'Three', originalTrainerId: 'trainer-1', updatedAt: new Date() }),
    );
  });

  test('a session with a creditId can never be created directly by a client, even the trainer (PKG-8)', async () => {
    await seedMembership('trainer-1', 'trainer');
    const db = testEnv.authenticatedContext('trainer-1').firestore();
    await assertFails(
      db.collection('pt_sessions').add({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        memberId: 'member-1',
        status: 'scheduled',
        creditId: 'some-credit-id',
      }),
    );
  });
});

describe('Trainer availability and busy slots (PKG-7, PKG-8)', () => {
  test('any tenant member can read availability; only the trainer or an admin can write it', async () => {
    await seedMembership('trainer-1', 'trainer');
    await seedMembership('trainer-2', 'trainer');
    await seedMembership('admin-1', 'admin');
    await seedMembership('member-1', 'member');

    const trainer1Db = testEnv.authenticatedContext('trainer-1').firestore();
    await assertSucceeds(
      trainer1Db.doc(`trainer_availability/${TENANT}_trainer-1`).set({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        weekly: { mon: [{ start: '08:00', end: '12:00' }] },
        slotMinutes: 60,
        exceptions: [],
      }),
    );

    const trainer2Db = testEnv.authenticatedContext('trainer-2').firestore();
    await assertFails(
      trainer2Db.doc(`trainer_availability/${TENANT}_trainer-1`).set({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        weekly: {},
        slotMinutes: 60,
        exceptions: [],
      }),
    );

    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(
      adminDb.doc(`trainer_availability/${TENANT}_trainer-1`).set({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        weekly: { mon: [{ start: '09:00', end: '13:00' }] },
        slotMinutes: 60,
        exceptions: [],
      }),
    );

    const memberDb = testEnv.authenticatedContext('member-1').firestore();
    await assertSucceeds(memberDb.doc(`trainer_availability/${TENANT}_trainer-1`).get());
  });

  test('busy slots are readable by any tenant member, writable by no client', async () => {
    await seedMembership('member-1', 'member');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('trainer_busy_slots/slot-1').set({
        tenantId: TENANT,
        trainerId: 'trainer-1',
        date: new Date(),
        durationMinutes: 60,
        status: 'scheduled',
      });
    });

    const memberDb = testEnv.authenticatedContext('member-1').firestore();
    await assertSucceeds(memberDb.doc('trainer_busy_slots/slot-1').get());
    await assertFails(memberDb.doc('trainer_busy_slots/slot-1').update({ status: 'cancelled' }));
    await assertFails(memberDb.collection('trainer_busy_slots').add({ tenantId: TENANT, trainerId: 'trainer-1', date: new Date(), durationMinutes: 60, status: 'scheduled' }));
  });
});

describe('Calendar shares', () => {
  test('a trainer can only share their OWN calendar', async () => {
    const db = testEnv.authenticatedContext('trainer-1').firestore();

    await assertSucceeds(
      db.doc(`calendar_shares/${TENANT}_trainer-1_trainer-2`).set({
        tenantId: TENANT,
        ownerTrainerId: 'trainer-1',
        viewerTrainerId: 'trainer-2',
      }),
    );
    // Impersonating another owner must fail, even with a well-formed id.
    await assertFails(
      db.doc(`calendar_shares/${TENANT}_trainer-9_trainer-1`).set({
        tenantId: TENANT,
        ownerTrainerId: 'trainer-9',
        viewerTrainerId: 'trainer-1',
      }),
    );
  });

  test('sharing with yourself is rejected', async () => {
    const db = testEnv.authenticatedContext('trainer-1').firestore();
    await assertFails(
      db.doc(`calendar_shares/${TENANT}_trainer-1_trainer-1`).set({
        tenantId: TENANT,
        ownerTrainerId: 'trainer-1',
        viewerTrainerId: 'trainer-1',
      }),
    );
  });
});

describe('Push tokens', () => {
  test('nobody can read push tokens from the client', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('push_tokens/tok-1').set({ userId: 'member-1', tenantId: TENANT });
    });
    const ownerDb = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(ownerDb.doc('push_tokens/tok-1').get());
  });

  test('a user can register and remove their own token but not somebody else\'s', async () => {
    // Doc ids must look like real Expo tokens and the writer must belong to
    // the gym — see the shape-validation rule on push_tokens.
    await seedMembership('member-1', 'member');
    const mine = 'push_tokens/ExponentPushToken[mine]';
    const theirs = 'push_tokens/ExponentPushToken[theirs]';
    const db = testEnv.authenticatedContext('member-1').firestore();

    await assertSucceeds(db.doc(mine).set({ userId: 'member-1', tenantId: TENANT, platform: 'ios' }));
    await assertFails(db.doc(theirs).set({ userId: 'other-uid', tenantId: TENANT, platform: 'ios' }));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(theirs).set({ userId: 'other-uid', tenantId: TENANT, platform: 'ios' });
    });
    await assertFails(db.doc(theirs).delete());
    await assertSucceeds(db.doc(mine).delete());
  });
});

describe('Programs', () => {
  test('only tenant staff can author a program; a member cannot', async () => {
    await seedMembership('member-1', 'member');
    await seedMembership('trainer-1', 'trainer');

    const memberDb = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(
      memberDb.collection('programs').add({ tenantId: TENANT, memberId: 'member-1', trainerId: 'member-1', status: 'draft', exercises: [] }),
    );

    const trainerDb = testEnv.authenticatedContext('trainer-1').firestore();
    await assertSucceeds(
      trainerDb.collection('programs').add({ tenantId: TENANT, memberId: 'member-1', trainerId: 'trainer-1', status: 'draft', exercises: [] }),
    );
  });

  test('a member can read their own program but not another member\'s', async () => {
    await seedMembership('member-1', 'member');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('programs/p-mine').set({ tenantId: TENANT, memberId: 'member-1', trainerId: 't', status: 'active', exercises: [] });
      await context.firestore().doc('programs/p-theirs').set({ tenantId: TENANT, memberId: 'member-2', trainerId: 't', status: 'active', exercises: [] });
    });

    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertSucceeds(db.doc('programs/p-mine').get());
    await assertFails(db.doc('programs/p-theirs').get());
  });
});

describe('Gym packages (PKG-1)', () => {
  const basePackage = {
    tenantId: TENANT,
    kind: 'membership',
    price: 500,
    entitlements: { gymAccess: true },
    activeAssignmentCount: 0,
    isActive: true,
    sortOrder: 0,
  };

  test('any active member of the tenant can read the catalog', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('gym_packages').add(basePackage);
    });
    await seedMembership('member-1', 'member');

    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertSucceeds(db.collection('gym_packages').where('tenantId', '==', TENANT).get());
  });

  test('a member from another gym cannot read the catalog', async () => {
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('gym_packages').add(basePackage);
      id = ref.id;
    });
    await seedMembership('outsider', 'member', OTHER_TENANT);

    const db = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(db.doc(`gym_packages/${id}`).get());
  });

  test('only a tenant admin may create a package', async () => {
    await seedMembership('trainer-1', 'trainer');
    await seedMembership('admin-1', 'admin');

    const trainerDb = testEnv.authenticatedContext('trainer-1').firestore();
    await assertFails(trainerDb.collection('gym_packages').add(basePackage));

    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(adminDb.collection('gym_packages').add(basePackage));
  });

  test('a package cannot be created with a non-zero assignment count', async () => {
    await seedMembership('admin-1', 'admin');
    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.collection('gym_packages').add({ ...basePackage, activeAssignmentCount: 3 }));
  });

  test('an unlocked package (no assignments) can be freely edited by the admin', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('gym_packages').add(basePackage);
      id = ref.id;
    });

    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(db.doc(`gym_packages/${id}`).update({ price: 750, name: 'Silver Plus' }));
  });

  test('a locked package (has assignments) rejects a content edit', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('gym_packages').add({ ...basePackage, activeAssignmentCount: 1 });
      id = ref.id;
    });

    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.doc(`gym_packages/${id}`).update({ price: 750 }));
    // Visibility/order stay editable even locked.
    await assertSucceeds(db.doc(`gym_packages/${id}`).update({ isActive: false }));
  });

  test('the client can never move activeAssignmentCount, locked or not', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('gym_packages').add(basePackage);
      id = ref.id;
    });

    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.doc(`gym_packages/${id}`).update({ activeAssignmentCount: 5 }));
  });

  test('packages are never deleted, even by an admin', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('gym_packages').add(basePackage);
      id = ref.id;
    });

    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.doc(`gym_packages/${id}`).delete());
  });
});

describe('Package change requests (PKG-6)', () => {
  const baseRequest = {
    tenantId: TENANT,
    memberId: 'member-1',
    memberName: 'Member One',
    kind: 'upgrade',
    proposedPackageId: 'pkg-gold',
    proposedSummary: { packageName: 'Gold', entitlements: { gymAccess: true }, price: 500, endsAt: new Date() },
    priceDelta: 100,
    effectiveAt: new Date(),
    expiresAt: new Date(Date.now() + 3 * 86400000),
    status: 'pending',
  };

  test('only a tenant admin may create a request, and only as themselves', async () => {
    await seedMembership('admin-1', 'admin');
    await seedMembership('trainer-1', 'trainer');

    const trainerDb = testEnv.authenticatedContext('trainer-1').firestore();
    await assertFails(trainerDb.collection('package_change_requests').add({ ...baseRequest, createdBy: 'trainer-1' }));

    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(adminDb.collection('package_change_requests').add({ ...baseRequest, createdBy: 'someone-else' }));
    await assertSucceeds(adminDb.collection('package_change_requests').add({ ...baseRequest, createdBy: 'admin-1' }));
  });

  test('the member has no direct write path to status — approve/reject only goes through approvePackageChange (Faz 1.6)', async () => {
    await seedMembership('admin-1', 'admin');
    await seedMembership('member-1', 'member');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('package_change_requests').add({ ...baseRequest, createdBy: 'admin-1' });
      id = ref.id;
    });

    const memberDb = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(memberDb.doc(`package_change_requests/${id}`).update({ status: 'approved', respondedAt: new Date() }));
    await assertFails(memberDb.doc(`package_change_requests/${id}`).update({ status: 'rejected', respondedAt: new Date() }));
  });

  test('another member cannot respond to someone else\'s request', async () => {
    await seedMembership('admin-1', 'admin');
    await seedMembership('stranger-uid', 'member');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('package_change_requests').add({ ...baseRequest, createdBy: 'admin-1' });
      id = ref.id;
    });

    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(strangerDb.doc(`package_change_requests/${id}`).update({ status: 'approved' }));
  });

  test('the admin can cancel a still-pending offer; not once it has been answered', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('package_change_requests').add({ ...baseRequest, createdBy: 'admin-1' });
      id = ref.id;
    });
    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(adminDb.doc(`package_change_requests/${id}`).update({ status: 'cancelled' }));

    let id2 = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('package_change_requests').add({ ...baseRequest, createdBy: 'admin-1', status: 'approved' });
      id2 = ref.id;
    });
    await assertFails(adminDb.doc(`package_change_requests/${id2}`).update({ status: 'cancelled' }));
  });

  test('a member reads their own request; a colleague of theirs does not', async () => {
    await seedMembership('admin-1', 'admin');
    await seedMembership('member-1', 'member');
    await seedMembership('member-2', 'member');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('package_change_requests').add({ ...baseRequest, createdBy: 'admin-1' });
      id = ref.id;
    });

    await assertSucceeds(testEnv.authenticatedContext('member-1').firestore().doc(`package_change_requests/${id}`).get());
    await assertFails(testEnv.authenticatedContext('member-2').firestore().doc(`package_change_requests/${id}`).get());
  });
});

describe('Promotions (PKG-5)', () => {
  const basePromotion = {
    tenantId: TENANT,
    name: 'Yıllık üyeliğe 1 ay hediye',
    kind: 'bonusDays',
    value: 30,
    appliesTo: [],
    startsAt: new Date(Date.now() - 86400000),
    endsAt: new Date(Date.now() + 30 * 86400000),
    redeemed: 0,
    isActive: true,
  };

  test('staff can read; only a tenant admin may create', async () => {
    await seedMembership('trainer-1', 'trainer');
    await seedMembership('admin-1', 'admin');

    const trainerDb = testEnv.authenticatedContext('trainer-1').firestore();
    await assertFails(trainerDb.collection('promotions').add(basePromotion));

    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(adminDb.collection('promotions').add(basePromotion));

    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('promotions').add(basePromotion);
      id = ref.id;
    });
    await assertSucceeds(trainerDb.doc(`promotions/${id}`).get());
  });

  test('a promotion cannot be created already redeemed', async () => {
    await seedMembership('admin-1', 'admin');
    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.collection('promotions').add({ ...basePromotion, redeemed: 2 }));
  });

  test('an admin can edit any field except redeemed directly', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('promotions').add(basePromotion);
      id = ref.id;
    });
    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(db.doc(`promotions/${id}`).update({ isActive: false, value: 45 }));
    await assertFails(db.doc(`promotions/${id}`).update({ redeemed: 5 }));
  });

  test('redemption may only move redeemed by exactly +1, and only under the cap', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('promotions').add({ ...basePromotion, maxRedemptions: 1 });
      id = ref.id;
    });
    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.doc(`promotions/${id}`).update({ redeemed: 2 })); // skips ahead
    await assertSucceeds(db.doc(`promotions/${id}`).update({ redeemed: 1 })); // the one allowed slot
    await assertFails(db.doc(`promotions/${id}`).update({ redeemed: 2 })); // now over the cap
  });

  test('a tenant admin can delete a promotion', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('promotions').add(basePromotion);
      id = ref.id;
    });
    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(db.doc(`promotions/${id}`).delete());
  });
});

describe('Member packages and credits (PKG-2)', () => {
  async function seedActivePackage(packageId = 'pkg-gold') {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`gym_packages/${packageId}`).set({
        tenantId: TENANT,
        name: 'Gold',
        kind: 'membership',
        price: 500,
        entitlements: { gymAccess: true },
        activeAssignmentCount: 0,
        isActive: true,
        sortOrder: 0,
      });
    });
    return packageId;
  }

  const assignment = (packageId: string) => ({
    tenantId: TENANT,
    memberId: 'member-1',
    memberName: 'Member One',
    packageId,
    packageName: 'Gold',
    kind: 'membership',
    entitlements: { gymAccess: true },
    listPrice: 500,
    finalPrice: 500,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 30 * 86400000),
    frozenDays: 0,
    freezes: [],
    status: 'active',
  });

  test('only a tenant admin may assign a package, and only as themselves', async () => {
    const packageId = await seedActivePackage();
    await seedMembership('admin-1', 'admin');
    await seedMembership('trainer-1', 'trainer');

    const trainerDb = testEnv.authenticatedContext('trainer-1').firestore();
    await assertFails(
      trainerDb.collection('member_packages').add({ ...assignment(packageId), assignedBy: 'trainer-1' }),
    );

    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(
      // Assigning "as" someone else must fail even for an admin.
      adminDb.collection('member_packages').add({ ...assignment(packageId), assignedBy: 'someone-else' }),
    );
    await assertSucceeds(
      adminDb.collection('member_packages').add({ ...assignment(packageId), assignedBy: 'admin-1' }),
    );
  });

  test('a retired (inactive) package cannot be assigned', async () => {
    const packageId = await seedActivePackage();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`gym_packages/${packageId}`).update({ isActive: false });
    });
    await seedMembership('admin-1', 'admin');

    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.collection('member_packages').add({ ...assignment(packageId), assignedBy: 'admin-1' }));
  });

  test('a member reads their own assignment; another member cannot', async () => {
    const packageId = await seedActivePackage();
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('member_packages').add({ ...assignment(packageId), assignedBy: 'admin-1' });
      id = ref.id;
    });
    await seedMembership('member-1', 'member');
    await seedMembership('member-2', 'member');

    const owner = testEnv.authenticatedContext('member-1').firestore();
    await assertSucceeds(owner.doc(`member_packages/${id}`).get());

    const other = testEnv.authenticatedContext('member-2').firestore();
    await assertFails(other.doc(`member_packages/${id}`).get());
  });

  test('an assignment can never be updated or deleted by a client, even an admin', async () => {
    const packageId = await seedActivePackage();
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('member_packages').add({ ...assignment(packageId), assignedBy: 'admin-1' });
      id = ref.id;
    });
    await seedMembership('admin-1', 'admin');

    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.doc(`member_packages/${id}`).update({ status: 'cancelled' }));
    await assertFails(db.doc(`member_packages/${id}`).delete());
  });

  const credit = () => ({
    tenantId: TENANT,
    memberId: 'member-1',
    kind: 'ptLesson',
    source: 'purchase',
    sourcePackageId: 'pkg-lessons',
    total: 8,
    used: 0,
    startsAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 86400000),
    status: 'active',
  });

  test('only a tenant admin may create a credit, and never pre-used', async () => {
    await seedMembership('admin-1', 'admin');
    await seedMembership('trainer-1', 'trainer');

    const trainerDb = testEnv.authenticatedContext('trainer-1').firestore();
    await assertFails(trainerDb.collection('member_credits').add(credit()));

    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(adminDb.collection('member_credits').add({ ...credit(), used: 3 }));
    await assertSucceeds(adminDb.collection('member_credits').add(credit()));
  });

  test('a credit can never be updated by a client — consumption is server-only', async () => {
    await seedMembership('admin-1', 'admin');
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('member_credits').add(credit());
      id = ref.id;
    });

    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertFails(db.doc(`member_credits/${id}`).update({ used: 1 }));
  });

  test('a member reads their own credit; staff reads it too; another member cannot', async () => {
    let id = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = await context.firestore().collection('member_credits').add(credit());
      id = ref.id;
    });
    await seedMembership('member-1', 'member');
    await seedMembership('trainer-1', 'trainer');
    await seedMembership('member-2', 'member');

    await assertSucceeds(testEnv.authenticatedContext('member-1').firestore().doc(`member_credits/${id}`).get());
    await assertSucceeds(testEnv.authenticatedContext('trainer-1').firestore().doc(`member_credits/${id}`).get());
    await assertFails(testEnv.authenticatedContext('member-2').firestore().doc(`member_credits/${id}`).get());
  });
});

describe('Role model — multiple roles and delegated permissions', () => {
  async function seedRoles(
    uid: string,
    roles: string[],
    permissions: string[] = [],
    tenantId = TENANT,
    status = 'active',
  ) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tenant_memberships/${tenantId}_${uid}`).set({
        userId: uid,
        tenantId,
        status,
        roles,
        permissions,
      });
    });
  }

  test('legacy docs with only a single `role` field still work', async () => {
    // Written before the roles migration — must keep functioning until the
    // backfill lands, and after it for any doc that slipped through.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tenant_memberships/${TENANT}_legacy-admin`).set({
        userId: 'legacy-admin',
        tenantId: TENANT,
        status: 'active',
        role: 'admin',
      });
    });
    const db = testEnv.authenticatedContext('legacy-admin').firestore();
    await assertSucceeds(
      db.collection('checkins').add({ tenantId: TENANT, userId: 'someone', membershipId: 'x', accessReason: 'ok' }),
    );
  });

  test('an owner who also coaches holds both roles and gets both surfaces', async () => {
    await seedRoles('owner-coach', ['admin', 'trainer']);
    const db = testEnv.authenticatedContext('owner-coach').firestore();

    // Admin surface: check-in.
    await assertSucceeds(
      db.collection('checkins').add({ tenantId: TENANT, userId: 'someone', membershipId: 'x', accessReason: 'ok' }),
    );
    // Trainer surface: book onto their own PT calendar.
    await assertSucceeds(
      db.collection('pt_sessions').add({
        tenantId: TENANT,
        trainerId: 'owner-coach',
        memberId: 'member-1',
        status: 'scheduled',
      }),
    );
  });

  test('a plain trainer cannot check members in', async () => {
    await seedRoles('trainer-only', ['trainer']);
    const db = testEnv.authenticatedContext('trainer-only').firestore();
    await assertFails(
      db.collection('checkins').add({ tenantId: TENANT, userId: 'someone', membershipId: 'x', accessReason: 'ok' }),
    );
  });

  test('a trainer granted the checkin permission can — without becoming an admin', async () => {
    await seedRoles('front-desk', ['trainer'], ['checkin']);
    const db = testEnv.authenticatedContext('front-desk').firestore();

    await assertSucceeds(
      db.collection('checkins').add({ tenantId: TENANT, userId: 'someone', membershipId: 'x', accessReason: 'ok' }),
    );
    // Still not an admin: the payment ledger stays closed.
    await assertFails(
      db.collection('payments').add({
        tenantId: TENANT,
        memberId: 'member-9',
        memberName: 'X',
        amount: 100,
        method: 'cash',
        status: 'confirmed',
      }),
    );
  });

  test('a trainer cannot grant themselves the checkin permission', async () => {
    await seedRoles('sneaky', ['trainer']);
    const db = testEnv.authenticatedContext('sneaky').firestore();
    await assertFails(
      db.doc(`tenant_memberships/${TENANT}_sneaky`).update({ permissions: ['checkin'] }),
    );
  });

  test('an admin can assign roles and permissions to someone else', async () => {
    await seedRoles('boss', ['admin']);
    await seedRoles('staffer', ['trainer']);
    const db = testEnv.authenticatedContext('boss').firestore();

    await assertSucceeds(
      db.doc(`tenant_memberships/${TENANT}_staffer`).update({ permissions: ['checkin'] }),
    );
    await assertSucceeds(
      db.doc(`tenant_memberships/${TENANT}_staffer`).update({ roles: ['trainer', 'admin'] }),
    );
  });

  test('an admin cannot strip their own admin role and strand the gym', async () => {
    await seedRoles('boss', ['admin', 'trainer']);
    const db = testEnv.authenticatedContext('boss').firestore();

    await assertFails(db.doc(`tenant_memberships/${TENANT}_boss`).update({ roles: ['trainer'] }));
    // Keeping admin while editing the rest is fine.
    await assertSucceeds(
      db.doc(`tenant_memberships/${TENANT}_boss`).update({ roles: ['admin'] }),
    );
  });

  test('permissions do not leak across gyms', async () => {
    await seedRoles('visitor', ['trainer'], ['checkin'], OTHER_TENANT);
    const db = testEnv.authenticatedContext('visitor').firestore();
    await assertFails(
      db.collection('checkins').add({ tenantId: TENANT, userId: 'someone', membershipId: 'x', accessReason: 'ok' }),
    );
  });

  test('a suspended membership grants nothing, whatever its roles say', async () => {
    await seedRoles('suspended-admin', ['admin'], ['checkin'], TENANT, 'suspended');
    const db = testEnv.authenticatedContext('suspended-admin').firestore();
    await assertFails(
      db.collection('checkins').add({ tenantId: TENANT, userId: 'someone', membershipId: 'x', accessReason: 'ok' }),
    );
  });
});

describe('Leaving a gym', () => {
  async function seed(uid: string, roles: string[], status = 'active') {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tenant_memberships/${TENANT}_${uid}`).set({
        userId: uid,
        tenantId: TENANT,
        status,
        roles,
        permissions: [],
      });
    });
  }

  test('a member can end their own membership', async () => {
    await seed('leaver', ['member']);
    const db = testEnv.authenticatedContext('leaver').firestore();
    await assertSucceeds(
      db.doc(`tenant_memberships/${TENANT}_leaver`).update({ status: 'left', leftAt: new Date() }),
    );
  });

  test('a trainer can too', async () => {
    await seed('coach', ['trainer']);
    const db = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(
      db.doc(`tenant_memberships/${TENANT}_coach`).update({ status: 'left', leftAt: new Date() }),
    );
  });

  test('an admin cannot use this path — they might be the gym\'s last one', async () => {
    await seed('boss', ['admin', 'trainer']);
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertFails(
      db.doc(`tenant_memberships/${TENANT}_boss`).update({ status: 'left', leftAt: new Date() }),
    );
  });

  test('leaving cannot be abused to grant yourself anything', async () => {
    await seed('sneaky', ['member']);
    const db = testEnv.authenticatedContext('sneaky').firestore();

    // Smuggling a role change alongside the status change must fail.
    await assertFails(
      db.doc(`tenant_memberships/${TENANT}_sneaky`).update({ status: 'left', roles: ['admin'] }),
    );
    // Reactivating yourself is not "leaving".
    await assertFails(db.doc(`tenant_memberships/${TENANT}_sneaky`).update({ status: 'active' }));
  });

  test('you cannot make somebody else leave', async () => {
    await seed('victim', ['member']);
    await seed('attacker', ['member']);
    const db = testEnv.authenticatedContext('attacker').firestore();
    await assertFails(
      db.doc(`tenant_memberships/${TENANT}_victim`).update({ status: 'left', leftAt: new Date() }),
    );
  });

  test('a left membership grants no access', async () => {
    await seed('gone', ['member'], 'left');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('classes/c-left').set({
        tenantId: TENANT,
        name: 'Pilates',
        capacity: 10,
        bookedUserIds: [],
        waitlistUserIds: [],
      });
    });
    const db = testEnv.authenticatedContext('gone').firestore();
    await assertFails(db.doc('classes/c-left').get());
  });
});

describe('Tenant private data and push tokens', () => {
  test('gym contact details live in a private subdoc, not on the public tenant doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tenants/${TENANT}`).set({ code: 'X-01', name: 'Gym', ownerUid: 'owner' });
      await context.firestore().doc(`tenants/${TENANT}/private/contact`).set({
        contactEmail: 'gym@example.com',
        contactPhone: '+90...',
      });
      await context.firestore().doc(`tenant_memberships/${TENANT}_insider`).set({
        userId: 'insider', tenantId: TENANT, status: 'active', roles: ['member'], permissions: [],
      });
      await context.firestore().doc(`tenant_memberships/${TENANT}_boss`).set({
        userId: 'boss', tenantId: TENANT, status: 'active', roles: ['admin'], permissions: [],
      });
    });

    // The tenant doc itself stays readable — joining by code needs it.
    const outsider = testEnv.authenticatedContext('outsider').firestore();
    await assertSucceeds(outsider.doc(`tenants/${TENANT}`).get());
    // ...but the contact details must not be.
    await assertFails(outsider.doc(`tenants/${TENANT}/private/contact`).get());

    const insider = testEnv.authenticatedContext('insider').firestore();
    await assertSucceeds(insider.doc(`tenants/${TENANT}/private/contact`).get());
    // A plain member reads but cannot edit.
    await assertFails(insider.doc(`tenants/${TENANT}/private/contact`).update({ contactPhone: '0' }));

    const boss = testEnv.authenticatedContext('boss').firestore();
    await assertSucceeds(boss.doc(`tenants/${TENANT}/private/contact`).update({ contactPhone: '0' }));
  });

  test('a push token must be well-formed, self-owned and inside a gym you belong to', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tenant_memberships/${TENANT}_member-1`).set({
        userId: 'member-1', tenantId: TENANT, status: 'active', roles: ['member'], permissions: [],
      });
    });
    const db = testEnv.authenticatedContext('member-1').firestore();
    const good = { userId: 'member-1', tenantId: TENANT, platform: 'ios' };

    await assertSucceeds(db.doc('push_tokens/ExponentPushToken[abc123]').set(good));
    // Not a real Expo token shape.
    await assertFails(db.doc('push_tokens/garbage').set(good));
    // Someone else's uid.
    await assertFails(db.doc('push_tokens/ExponentPushToken[x]').set({ ...good, userId: 'other' }));
    // A gym they don't belong to.
    await assertFails(db.doc('push_tokens/ExponentPushToken[y]').set({ ...good, tenantId: OTHER_TENANT }));
    // Nonsense platform.
    await assertFails(db.doc('push_tokens/ExponentPushToken[z]').set({ ...good, platform: 'blackberry' }));
  });

  test('push tokens are never readable from the client, not even your own', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('push_tokens/ExponentPushToken[mine]').set({
        userId: 'member-1', tenantId: TENANT, platform: 'ios',
      });
    });
    const db = testEnv.authenticatedContext('member-1').firestore();
    await assertFails(db.doc('push_tokens/ExponentPushToken[mine]').get());
    // Deleting your own registration (sign-out) must still work.
    await assertSucceeds(db.doc('push_tokens/ExponentPushToken[mine]').delete());
  });
});

describe('No platform super-user over tenant data (P1-6)', () => {
  /**
   * marte06's global `admin` claim used to satisfy every GymEntra check.
   * These assertions exist so it can never quietly come back: a white-label
   * product must not ship a claim that reads every customer gym's data.
   */
  const root = () => testEnv.authenticatedContext('platform-root', { admin: true }).firestore();

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`tenants/${TENANT}`).set({ code: 'X-01', name: 'Gym', ownerUid: 'someone-else' });
      await db.doc('measurements/m1').set({ tenantId: TENANT, memberId: 'member-1', weightKg: 70 });
      await db.doc('workout_logs/w1').set({ tenantId: TENANT, memberId: 'member-1', programId: 'p', exerciseLogs: [] });
      await db.doc('programs/p1').set({ tenantId: TENANT, memberId: 'member-1', trainerId: 't', status: 'active', exercises: [] });
      await db.collection('payments').doc('pay1').set({
        tenantId: TENANT, memberId: 'member-1', amount: 100, method: 'cash', status: 'confirmed',
      });
      await db.doc(`tenant_memberships/${TENANT}_member-1`).set({
        userId: 'member-1', tenantId: TENANT, status: 'active', roles: ['member'], permissions: [],
      });
    });
  });

  test('the global admin claim cannot read another gym\'s member data', async () => {
    const db = root();
    await assertFails(db.doc('measurements/m1').get());
    await assertFails(db.doc('workout_logs/w1').get());
    await assertFails(db.doc('programs/p1').get());
    await assertFails(db.doc('payments/pay1').get());
    await assertFails(db.doc(`tenant_memberships/${TENANT}_member-1`).get());
  });

  test('the global admin claim cannot write tenant data or admit members', async () => {
    const db = root();
    await assertFails(db.doc(`tenants/${TENANT}`).update({ name: 'Hijacked' }));
    await assertFails(
      db.doc(`tenant_memberships/${TENANT}_member-1`).update({ roles: ['admin'] }),
    );
    await assertFails(
      db.collection('checkins').add({ tenantId: TENANT, userId: 'member-1', membershipId: 'x', accessReason: 'ok' }),
    );
  });

  test('legacy marte06 collections keep their admin access', async () => {
    // The claim is still the web app's authorisation model — only GymEntra
    // stopped honouring it.
    const db = root();
    await assertSucceeds(db.doc('members/member-a').get());
    await assertSucceeds(db.doc('settings/app').set({ logoPath: 'x.png' }));
  });
});

describe('Free-tier member limit (P0-1)', () => {
  async function setupGym(activeMemberCount: number, subscription?: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`tenants/${TENANT}`).set({
        code: 'X-01', name: 'Gym', ownerUid: 'boss', activeMemberCount,
        ...(subscription ? { subscription } : {}),
      });
      await db.doc(`tenant_memberships/${TENANT}_boss`).set({
        userId: 'boss', tenantId: TENANT, status: 'active', roles: ['admin'], permissions: [],
      });
      await db.doc(`tenant_memberships/${TENANT}_pending-1`).set({
        userId: 'pending-1', tenantId: TENANT, status: 'pending', roles: ['member'], permissions: [],
      });
    });
  }

  test('an admin can approve a member while under the free limit', async () => {
    await setupGym(9);
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertSucceeds(db.doc(`tenant_memberships/${TENANT}_pending-1`).update({ status: 'active' }));
  });

  test('approval is blocked at the limit — the client check is not the only gate', async () => {
    await setupGym(10);
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertFails(db.doc(`tenant_memberships/${TENANT}_pending-1`).update({ status: 'active' }));
  });

  test('an active subscription lifts the limit', async () => {
    await setupGym(250, { status: 'active', plan: 'monthly' });
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertSucceeds(db.doc(`tenant_memberships/${TENANT}_pending-1`).update({ status: 'active' }));
  });

  test('an expired subscription does not', async () => {
    await setupGym(250, { status: 'expired', plan: 'monthly' });
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertFails(db.doc(`tenant_memberships/${TENANT}_pending-1`).update({ status: 'active' }));
  });

  test('rejecting and suspending stay free at the limit', async () => {
    await setupGym(10);
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertSucceeds(db.doc(`tenant_memberships/${TENANT}_pending-1`).update({ status: 'rejected' }));
  });

  test('hiring staff is never paywalled', async () => {
    await setupGym(10);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tenant_memberships/${TENANT}_coach`).set({
        userId: 'coach', tenantId: TENANT, status: 'pending', roles: ['trainer'], permissions: [],
      });
    });
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertSucceeds(db.doc(`tenant_memberships/${TENANT}_coach`).update({ status: 'active' }));
  });

  test('an admin cannot grant themselves a subscription or edit the seat tally', async () => {
    await setupGym(10);
    const db = testEnv.authenticatedContext('boss').firestore();
    await assertFails(db.doc(`tenants/${TENANT}`).update({ subscription: { status: 'active' } }));
    await assertFails(db.doc(`tenants/${TENANT}`).update({ activeMemberCount: 0 }));
    // Branding edits still work.
    await assertSucceeds(db.doc(`tenants/${TENANT}`).update({ name: 'Yeni Ad' }));
  });
});
