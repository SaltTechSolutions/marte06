import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

const FROM = process.env.AUTH_MAIL_FROM ?? 'GymEntra <hesap@salt-tech-apps.com>';

/**
 * Sends a password-reset link (PER-2, Kuşak 1.5).
 *
 * The app had no way out of a forgotten password at all: e-mail/password
 * sign-up existed, `sendPasswordResetEmail` was never called anywhere, and a
 * member who forgot theirs was simply locked out with no self-service path.
 *
 * Why a callable instead of the client's own `sendPasswordResetEmail`: that
 * one goes through Firebase's mail service and its default template. Doing it
 * here means the link is delivered by Resend from our verified domain, in
 * Turkish, in the product's voice — and this is the one message a locked-out
 * member reads, so it is worth owning.
 *
 * **Always reports success**, whether or not the address has an account.
 * Answering honestly would turn this into an account-enumeration oracle:
 * anyone could type addresses and learn which ones are members of a gym. The
 * caller cannot tell the two cases apart, which is the point.
 */
export const requestPasswordReset = onCall(
  { region: 'europe-west1', secrets: [RESEND_API_KEY], enforceAppCheck: false },
  async (request) => {
    const email = String(request.data?.email ?? '').trim().toLowerCase();
    // Shape check only. An invalid address cannot belong to anyone, so
    // refusing it leaks nothing.
    if (!email || !email.includes('@') || email.length > 320) {
      return { ok: true };
    }

    let link: string;
    try {
      link = await admin.auth().generatePasswordResetLink(email);
    } catch (e) {
      // Almost always auth/user-not-found. Swallowed on purpose — see above.
      console.log('[passwordReset] bağlantı üretilemedi (muhtemelen hesap yok)', (e as Error).message);
      return { ok: true };
    }

    const key = RESEND_API_KEY.value();
    if (!key) {
      console.error('[passwordReset] RESEND_API_KEY yok — sıfırlama e-postası GÖNDERİLEMEDİ');
      return { ok: true };
    }

    const text = [
      'Merhaba,',
      '',
      'GymEntra hesabının şifresini sıfırlamak için aşağıdaki bağlantıya tıkla:',
      link,
      '',
      'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.',
      'Bağlantı bir süre sonra geçersiz olur.',
      '',
      'GymEntra',
    ].join('\n');

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [email], subject: 'GymEntra — şifre sıfırlama', text }),
      });
      if (!res.ok) console.error('[passwordReset] Resend reddetti', res.status, await res.text());
    } catch (e) {
      console.error('[passwordReset] e-posta gönderilemedi', e);
    }

    // Still `ok` on a send failure: the screen must not tell one caller
    // "sent" and another "failed" based on anything tied to the address.
    return { ok: true };
  },
);
