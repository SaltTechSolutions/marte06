import * as admin from 'firebase-admin';

/**
 * Looks up every registered device for a user and pushes to all of them via
 * Expo's push service. Best-effort: a user with no tokens (never opened the
 * app, denied permission, simulator-only) is a silent no-op, not an error.
 */
export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  const tokensSnap = await admin.firestore().collection('push_tokens').where('userId', '==', userId).get();
  if (tokensSnap.empty) return;

  const messages = tokensSnap.docs.map((tokenDoc) => ({
    to: tokenDoc.id,
    title,
    body,
    sound: 'default',
    ...(data ? { data } : {}),
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = (await response.json().catch(() => null)) as
    | { data?: { status?: string; details?: { error?: string } }[] }
    | null;
  console.log(`Push to ${userId} (${messages.length} device(s)):`, JSON.stringify(result));

  // Expo answers per message, in the order we sent them. A DeviceNotRegistered
  // error means the app was uninstalled or the token was revoked — keeping it
  // costs a wasted request on every future push and the row never expires on
  // its own, so drop it here.
  const tickets = result?.data ?? [];
  const dead = tickets
    .map((ticket, i) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokensSnap.docs[i] : null))
    .filter((doc): doc is (typeof tokensSnap.docs)[number] => doc != null);

  if (dead.length > 0) {
    const batch = admin.firestore().batch();
    dead.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Removed ${dead.length} dead push token(s) for ${userId}`);
  }
}

