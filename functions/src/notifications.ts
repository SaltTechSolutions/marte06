import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';

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
