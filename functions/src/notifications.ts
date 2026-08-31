import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';

import { sendPushToUser } from './push';

/** GymEntra: member's join request just got approved. */
export const notifyOnMembershipApproved = onDocumentUpdated(
  { document: 'tenant_memberships/{membershipId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === 'active' || after.status !== 'active') return;

    await sendPushToUser(
      after.userId,
      'Üyeliğin onaylandı 🎉',
      `${after.tenantName} ailesine hoş geldin! Üyelik kartın artık hazır.`,
      { screen: 'member/card' },
    );
  },
);

/** GymEntra: a member-submitted payment notice was confirmed or rejected. */
export const notifyOnPaymentStatusChange = onDocumentUpdated(
  { document: 'payments/{paymentId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status !== 'pending' || after.status === 'pending') return;

    const amountLabel = `₺${Number(after.amount).toLocaleString('tr-TR')}`;
    if (after.status === 'confirmed') {
      await sendPushToUser(after.memberId, 'Ödemen onaylandı ✓', `${amountLabel} tutarındaki ödemen onaylandı.`, {
        screen: 'member/payments',
      });
    } else if (after.status === 'rejected') {
      await sendPushToUser(
        after.memberId,
        'Ödemen onaylanmadı',
        `${amountLabel} tutarındaki ödeme bildirimin reddedildi. Detay için salonla iletişime geç.`,
        { screen: 'member/payments' },
      );
    }
  },
);

/** GymEntra: a trainer just assigned (activated) a program for this member. */
export const notifyOnProgramAssigned = onDocumentUpdated(
  { document: 'programs/{programId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === 'active' || after.status !== 'active') return;

    await sendPushToUser(
      after.memberId,
      'Yeni programın hazır 💪',
      `Antrenörün senin için "${after.name}" programını hazırladı.`,
      { screen: 'member/workout' },
    );
  },
);

/**
 * GymEntra (PKG-6): notifies the member a swap is waiting on them.
 * `createPackageChangeRequest` never writes anything to `member_packages`
 * itself — this is purely "someone should look at this."
 */
export const notifyOnPackageChangeRequested = onDocumentCreated(
  { document: 'package_change_requests/{requestId}', region: 'europe-west1' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await sendPushToUser(
      data.memberId,
      'Paket teklifin var',
      `${data.proposedSummary?.packageName ?? 'Yeni paket'} için bir teklif bekliyor.`,
      { screen: 'member/index' },
    );
  },
);

/**
 * Pushes to every ACTIVE admin of a gym.
 *
 * Fans out rather than targeting an owner field: a gym can have several
 * admins, and whoever happens to own the tenant document is not necessarily
 * the one working the desk today.
 */
async function notifyTenantAdmins(
  tenantId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const admins = await admin
    .firestore()
    .collection('tenant_memberships')
    .where('tenantId', '==', tenantId)
    .where('roles', 'array-contains', 'admin')
    .where('status', '==', 'active')
    .get();

  await Promise.all(admins.docs.map((d) => sendPushToUser(d.data().userId, title, body, data)));
}

/**
 * GymEntra: a join request is waiting for the gym's approval.
 *
 * The owner's most time-sensitive event — someone may be standing at the
 * desk. Until this existed the only way to find out was to open the app and
 * look, which is how requests sat unnoticed.
 *
 * `onDocumentWritten`, not `onDocumentCreated`: a rejoin (P0-6) is an UPDATE
 * back to `pending` on the document the person already owns, so a
 * create-only trigger would miss every returning member.
 */
export const notifyAdminsOnJoinRequest = onDocumentWritten(
  { document: 'tenant_memberships/{membershipId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;
    if (before?.status === 'pending' || after.status !== 'pending') return;

    const who = after.userDisplayName || after.userEmail || 'Biri';
    const returning = before !== undefined;
    await notifyTenantAdmins(
      after.tenantId,
      'Yeni katılım isteği',
      returning ? `${who} salona tekrar katılmak istiyor.` : `${who} salona katılmak istiyor.`,
      { screen: 'admin/members' },
    );
  },
);

/**
 * GymEntra: tells the gym's admins that someone walked away.
 *
 * Leaving is entirely self-service (`leaveTenant` writes `status: 'left'`
 * straight from the client), so without this the roster silently shrinks and
 * the owner finds out by noticing a missing name. A gym billed per active
 * member needs to know the moment a seat frees up.
 *
 * Fans out to every active admin rather than an owner field: a gym can have
 * several, and the one who happens to own the tenant doc is not necessarily
 * the one working the desk.
 */
export const notifyAdminsOnMemberLeft = onDocumentUpdated(
  { document: 'tenant_memberships/{membershipId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === 'left' || after.status !== 'left') return;

    const who = after.userDisplayName || after.userEmail || 'Bir üye';
    await notifyTenantAdmins(after.tenantId, 'Bir üye salondan ayrıldı', `${who} üyeliğini sonlandırdı.`, {
      screen: 'admin/members',
    });
  },
);
