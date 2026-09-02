import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

const FROM = process.env.AUTH_MAIL_FROM ?? 'GymEntra <hesap@salt-tech-apps.com>';

/**
 * Seconds required since the previous send, indexed by how many have already
 * gone out to this address. Past the end of the list it stays at the last
 * value — one an hour, indefinitely.
 *
 * It degrades rather than stopping on purpose. A hard cap would let anyone
 * who knows your address burn your attempts and leave you unable to reset
 * your own password until the window cleared: the attacker cannot take the
 * account, but can lock you out of the way back into it. Slowing the flood
 * to a trickle stops the mail bomb without ever closing the door.
 */
const ADDRESS_BACKOFF_SECONDS = [0, 60, 5 * 60, 15 * 60, 60 * 60];
/** Quiet time that clears an address's counter completely. */
const ADDRESS_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Per-address limiting answers the mail-bomb ("hit one victim repeatedly")
 * but says nothing about the other shape of abuse: cycling through thousands
 * of DIFFERENT addresses, each of which gets its own free first send. That is
 * the one that burns the mail quota, so it needs a counter of its own.
 */
const IP_MAX_PER_WINDOW = 20;
const IP_WINDOW_MS = 60 * 60 * 1000;

/**
 * Counter keys are hashed, never the value itself.
 *
 * Stored raw, these collections would become a list of everyone who forgot
 * their password and a log of who connected from where — an IP address is
 * personal data. A hash answers the only question a throttle asks ("same one
 * as last time?") and nothing else.
 */
function key(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

interface Verdict {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** Reads a counter and decides, without writing. */
async function checkAddress(ref: FirebaseFirestore.DocumentReference, now: number): Promise<Verdict & { sends: number }> {
  const snap = await ref.get();
  const d = snap.data();
  if (!d) return { allowed: true, sends: 0 };

  const lastAt = (d.lastAt?.toMillis?.() as number | undefined) ?? 0;
  if (now - lastAt >= ADDRESS_WINDOW_MS) return { allowed: true, sends: 0 };

  const sends = Number(d.sends ?? 0);
  const requiredMs =
    (ADDRESS_BACKOFF_SECONDS[Math.min(sends, ADDRESS_BACKOFF_SECONDS.length - 1)] ?? 0) * 1000;
  if (now - lastAt < requiredMs) {
    return { allowed: false, retryAfterSeconds: Math.ceil((lastAt + requiredMs - now) / 1000), sends };
  }
  return { allowed: true, sends };
}

/** Fixed one-hour window per IP. Reserves the slot as it checks, so a burst
 *  of parallel calls cannot all read the same pre-increment count. */
async function reserveIpSlot(ip: string, now: number): Promise<Verdict> {
  const ref = admin.firestore().doc(`password_reset_ip/${key(ip)}`);
  try {
    return await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data();
      const startedAt = (d?.windowStartAt?.toMillis?.() as number | undefined) ?? 0;
      const fresh = now - startedAt >= IP_WINDOW_MS;
      const count = fresh ? 0 : Number(d?.count ?? 0);

      if (count >= IP_MAX_PER_WINDOW) {
        return { allowed: false, retryAfterSeconds: Math.ceil((startedAt + IP_WINDOW_MS - now) / 1000) };
      }
      tx.set(
        ref,
        {
          count: count + 1,
          windowStartAt: admin.firestore.Timestamp.fromMillis(fresh ? now : startedAt),
        },
        { merge: true },
      );
      return { allowed: true };
    });
  } catch (e) {
    // Fail open: a counter we cannot read must not stand between someone and
    // their own account. Logged so a persistent failure is visible.
    console.error('[passwordReset] IP sayacı okunamadı, geçiliyor', e);
    return { allowed: true };
  }
}

/** Advances an address's counter. Never throws — the reset matters more than
 *  perfect bookkeeping. */
async function bumpAddress(ref: FirebaseFirestore.DocumentReference, sends: number, now: number): Promise<void> {
  try {
    await ref.set(
      {
        sends: sends + 1,
        lastAt: admin.firestore.Timestamp.fromMillis(now),
        ...(sends === 0 ? { firstAt: admin.firestore.Timestamp.fromMillis(now) } : {}),
      },
      { merge: true },
    );
  } catch (e) {
    console.error('[passwordReset] adres sayacı yazılamadı', e);
  }
}

/**
 * Sends a password-reset link (PER-2).
 *
 * The app had no way out of a forgotten password at all: e-mail/password
 * sign-up existed, `sendPasswordResetEmail` was never called anywhere, and a
 * member who forgot theirs was locked out with no self-service path.
 *
 * Why a callable instead of the client's own `sendPasswordResetEmail`: that
 * goes through Firebase's mail service and its default template. Here the
 * link is delivered by Resend from our verified domain, in Turkish, in the
 * product's voice — this is the one message a locked-out member reads.
 *
 * **Always reports success**, whether or not the address has an account.
 * Answering honestly would make this an account-enumeration oracle: anyone
 * could type addresses and learn which belong to members.
 *
 * Both counters advance for EVERY request, including addresses with no
 * account. Throttling only real users would leak exactly what the uniform
 * response exists to hide — an attacker could tell the cases apart by how
 * soon a second try is accepted. Because the limits ignore account
 * existence, `retryAfterSeconds` is safe to return: it says this address (or
 * this connection) asked recently, which the asker already knows.
 */
export const requestPasswordReset = onCall(
  { region: 'europe-west1', secrets: [RESEND_API_KEY] },
  async (request) => {
    const email = String(request.data?.email ?? '').trim().toLowerCase();
    // Shape check only. An address that cannot exist reveals nothing.
    if (!email || !email.includes('@') || email.length > 320) {
      return { ok: true };
    }

    const now = Date.now();

    // IP first: it is the cheap check, and the one guarding the mail quota.
    const ip = request.rawRequest?.ip ?? 'unknown';
    const ipVerdict = await reserveIpSlot(ip, now);
    if (!ipVerdict.allowed) {
      console.log('[passwordReset] IP saatlik sınırı doldu');
      return { ok: true, retryAfterSeconds: ipVerdict.retryAfterSeconds };
    }

    const addressRef = admin.firestore().doc(`password_reset_throttle/${key(email)}`);
    let sends = 0;
    try {
      const verdict = await checkAddress(addressRef, now);
      if (!verdict.allowed) {
        console.log('[passwordReset] adres için çok erken');
        return { ok: true, retryAfterSeconds: verdict.retryAfterSeconds };
      }
      sends = verdict.sends;
    } catch (e) {
      console.error('[passwordReset] adres sayacı okunamadı, geçiliyor', e);
    }

    let link: string;
    try {
      link = await admin.auth().generatePasswordResetLink(email);
    } catch (e) {
      console.log('[passwordReset] bağlantı üretilemedi (muhtemelen hesap yok)', (e as Error).message);
      await bumpAddress(addressRef, sends, now);
      return { ok: true };
    }

    await bumpAddress(addressRef, sends, now);

    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
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
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [email], subject: 'GymEntra — şifre sıfırlama', text }),
      });
      if (!res.ok) console.error('[passwordReset] Resend reddetti', res.status, await res.text());
    } catch (e) {
      console.error('[passwordReset] e-posta gönderilemedi', e);
    }

    // Still `ok` on a send failure: the answer must never vary with anything
    // tied to the address.
    return { ok: true };
  },
);
