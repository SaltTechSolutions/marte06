import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';

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
        paymentId: event.params.paymentId,
      });
    } else if (after.status === 'rejected') {
      await sendPushToUser(
        after.memberId,
        'Ödemen onaylanmadı',
        `${amountLabel} tutarındaki ödeme bildirimin reddedildi. Detay için salonla iletişime geç.`,
        { screen: 'member/payments', paymentId: event.params.paymentId },
      );
    }
  },
);

/**
 * ADMIN-4: a recorded payment was corrected.
 *
 * Both sides hear about it, which is the point — a silent correction to
 * someone's payment history is exactly the kind of thing that turns into a
 * phone call. The member sees why, the other admins see who did it.
 *
 * Fires on the ORIGINAL row being flagged rather than on the reversal row
 * being created: the flag is the single moment the correction becomes true,
 * and the reversal row is written in the same batch either way.
 */
export const notifyOnPaymentReversed = onDocumentUpdated(
  { document: 'payments/{paymentId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.reversedAt || !after.reversedAt) return;

    const amountLabel = `₺${Number(after.amount).toLocaleString('tr-TR')}`;
    const reason = (after.reversalReason as string | undefined)?.trim();
    const detail = reason ? ` Gerekçe: ${reason}` : '';

    await sendPushToUser(
      after.memberId,
      'Ödeme kaydın düzeltildi',
      `${amountLabel} tutarındaki kaydın salon tarafından düzeltildi.${detail}`,
      { screen: 'member/payments', paymentId: event.params.paymentId },
    );

    await notifyTenantAdmins(
      after.tenantId,
      'Ödeme kaydı düzeltildi',
      `${after.memberName ?? 'Bir üye'} · ${amountLabel}${detail}`,
      { screen: 'admin/payments', paymentId: event.params.paymentId },
      // The admin who made the correction already knows.
      after.reversedBy as string | undefined,
    );
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
  /** Skip one admin — the one who performed the action already knows, and a
   *  push telling you what you just did is noise people learn to dismiss. */
  exceptUserId?: string,
): Promise<void> {
  const admins = await admin
    .firestore()
    .collection('tenant_memberships')
    .where('tenantId', '==', tenantId)
    .where('roles', 'array-contains', 'admin')
    .where('status', '==', 'active')
    .get();

  await Promise.all(
    admins.docs
      .map((d) => d.data().userId as string)
      .filter((userId) => userId !== exceptUserId)
      .map((userId) => sendPushToUser(userId, title, body, data)),
  );
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

/**
 * GymEntra: a class was cancelled — tell the people who had booked it.
 *
 * Cancelling is the one admin action that silently changes somebody else's
 * plans: the class simply vanishes from their schedule. Without this a member
 * turns up to a session that no longer exists.
 *
 * Fired on delete rather than on a `cancelled` flag because that is what
 * `deleteClass` does today. The waitlist is notified too — they were holding
 * a place for this slot and their answer ("am I in?") is now settled.
 */
export const notifyOnClassCancelled = onDocumentDeleted(
  { document: 'classes/{classId}', region: 'europe-west1' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const affected: string[] = [
      ...((data.bookedUserIds as string[] | undefined) ?? []),
      ...((data.waitlistUserIds as string[] | undefined) ?? []),
    ];
    if (affected.length === 0) return;

    const when = (data.date as admin.firestore.Timestamp | undefined)?.toDate();
    const whenLabel = when
      ? when.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : '';

    await Promise.all(
      affected.map((uid) =>
        sendPushToUser(
          uid,
          'Ders iptal edildi',
          `${data.name ?? 'Ders'}${whenLabel ? ` — ${whenLabel}` : ''} iptal edildi.`,
          { screen: 'member/classes' },
        ),
      ),
    );
  },
);
