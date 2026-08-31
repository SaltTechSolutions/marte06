import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { sendPushToUser } from './push';

/**
 * Parent–child links for under-18 members (MEMBER-5b).
 *
 * Both operations are callables rather than security rules for the same
 * reason: each one has to LOOK SOMETHING UP. Finding the parent by e-mail is a
 * query over the roster, which rules cannot run and which a plain member is
 * deliberately not allowed to list. And the consent record has to be stamped
 * with a server timestamp the child cannot choose.
 */

/** The consent text the parent is agreeing to. Bumped whenever the wording
 *  changes, so an old record still says which version was accepted. */
export const GUARDIAN_CONSENT_VERSION = '2026-08-31.v1';

function requireUid(request: { auth?: { uid?: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
  return uid;
}

/**
 * A member (in practice a minor) nominates a parent by e-mail.
 *
 * The parent must already be a member of the same gym — decision 1 makes them
 * a real member, not a free-text contact, because they will be paying and
 * booking. If they are not, the child is told to have them join first; we do
 * not create an account on someone else's behalf.
 */
export const requestGuardian = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireUid(request);
  const tenantId = String(request.data?.tenantId ?? '');
  const email = String(request.data?.guardianEmail ?? '').trim().toLowerCase();
  if (!tenantId || !email) {
    throw new HttpsError('invalid-argument', 'Salon ve ebeveyn e-postası gerekiyor.');
  }

  const db = admin.firestore();
  const childRef = db.doc(`tenant_memberships/${tenantId}_${uid}`);
  const childSnap = await childRef.get();
  if (!childSnap.exists) {
    throw new HttpsError('not-found', 'Bu salonda üyeliğin bulunamadı.');
  }
  const child = childSnap.data()!;

  if (String(child.userEmail ?? '').toLowerCase() === email) {
    throw new HttpsError('invalid-argument', 'Kendini ebeveyn olarak seçemezsin.');
  }

  const matches = await db
    .collection('tenant_memberships')
    .where('tenantId', '==', tenantId)
    .where('userEmail', '==', email)
    .limit(2)
    .get();
  const guardianDoc = matches.docs.find((d) => d.data().status === 'active');
  if (!guardianDoc) {
    throw new HttpsError(
      'not-found',
      'Bu e-postayla salonda aktif bir üye bulunamadı. Ebeveynin önce salona üye olmalı.',
    );
  }
  const guardian = guardianDoc.data();

  // A child cannot be their own grandparent: if the nominated parent is
  // themselves a minor linked to someone, the chain is almost certainly a
  // mistake. Rejecting it here is cheaper than untangling it later.
  if (guardian.guardianId) {
    throw new HttpsError(
      'failed-precondition',
      'Seçtiğin üye kendisi bir ebeveyne bağlı. Lütfen yetişkin bir üye seç.',
    );
  }

  await childRef.update({
    guardianId: guardian.userId,
    guardianName: guardian.userDisplayName ?? guardian.userEmail ?? '',
    guardianStatus: 'pending',
    // A re-request after a rejection must not carry the old consent forward.
    guardianConsentAt: admin.firestore.FieldValue.delete(),
    guardianConsentVersion: admin.firestore.FieldValue.delete(),
  });

  await sendPushToUser(
    guardian.userId,
    'Ebeveyn onayı isteniyor',
    `${child.userDisplayName ?? child.userEmail ?? 'Bir üye'} seni ebeveyni olarak gösterdi.`,
    { screen: '/member/guardian-requests' },
  );

  return { guardianName: guardian.userDisplayName ?? guardian.userEmail ?? '' };
});

/**
 * The parent answers. Approving records the consent (KVKK): when, by whom,
 * against which version of the text.
 *
 * The child's own `status` is untouched — the gym still has to approve them
 * separately, and that gate is enforced in the rules.
 */
export const respondToGuardian = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireUid(request);
  const tenantId = String(request.data?.tenantId ?? '');
  const childId = String(request.data?.childId ?? '');
  const approve = request.data?.approve === true;
  if (!tenantId || !childId) {
    throw new HttpsError('invalid-argument', 'Salon ve üye bilgisi gerekiyor.');
  }

  const db = admin.firestore();
  const childRef = db.doc(`tenant_memberships/${tenantId}_${childId}`);
  const childSnap = await childRef.get();
  if (!childSnap.exists) {
    throw new HttpsError('not-found', 'Üye bulunamadı.');
  }
  const child = childSnap.data()!;

  if (child.guardianId !== uid) {
    throw new HttpsError('permission-denied', 'Bu istek sana ait değil.');
  }
  if (child.guardianStatus !== 'pending') {
    throw new HttpsError('failed-precondition', 'Bu istek zaten yanıtlanmış.');
  }

  if (approve) {
    await childRef.update({
      guardianStatus: 'approved',
      guardianConsentAt: admin.firestore.FieldValue.serverTimestamp(),
      guardianConsentVersion: GUARDIAN_CONSENT_VERSION,
    });
  } else {
    // The link is cleared, not left as 'rejected' with a guardianId: leaving
    // it would keep granting that person read access to the child's record.
    await childRef.update({
      guardianId: admin.firestore.FieldValue.delete(),
      guardianName: admin.firestore.FieldValue.delete(),
      guardianStatus: 'rejected',
    });
  }

  await sendPushToUser(
    child.userId,
    approve ? 'Ebeveyn onayın alındı' : 'Ebeveyn onayı verilmedi',
    approve
      ? 'Kaydın salon yöneticisinin onayını bekliyor.'
      : 'Gösterdiğin ebeveyn onay vermedi. Başka bir ebeveyn seçebilirsin.',
    { screen: '/member/edit-profile' },
  );

  return { approved: approve };
});
