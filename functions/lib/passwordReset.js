"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPasswordReset = void 0;
const node_crypto_1 = require("node:crypto");
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
const FROM = (_a = process.env.AUTH_MAIL_FROM) !== null && _a !== void 0 ? _a : 'GymEntra <hesap@salt-tech-apps.com>';
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
function key(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
}
/** Reads a counter and decides, without writing. */
async function checkAddress(ref, now) {
    var _a, _b, _c, _d, _e;
    const snap = await ref.get();
    const d = snap.data();
    if (!d)
        return { allowed: true, sends: 0 };
    const lastAt = (_c = (_b = (_a = d.lastAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : 0;
    if (now - lastAt >= ADDRESS_WINDOW_MS)
        return { allowed: true, sends: 0 };
    const sends = Number((_d = d.sends) !== null && _d !== void 0 ? _d : 0);
    const requiredMs = ((_e = ADDRESS_BACKOFF_SECONDS[Math.min(sends, ADDRESS_BACKOFF_SECONDS.length - 1)]) !== null && _e !== void 0 ? _e : 0) * 1000;
    if (now - lastAt < requiredMs) {
        return { allowed: false, retryAfterSeconds: Math.ceil((lastAt + requiredMs - now) / 1000), sends };
    }
    return { allowed: true, sends };
}
/** Fixed one-hour window per IP. Reserves the slot as it checks, so a burst
 *  of parallel calls cannot all read the same pre-increment count. */
async function reserveIpSlot(ip, now) {
    const ref = admin.firestore().doc(`password_reset_ip/${key(ip)}`);
    try {
        return await admin.firestore().runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const snap = await tx.get(ref);
            const d = snap.data();
            const startedAt = (_c = (_b = (_a = d === null || d === void 0 ? void 0 : d.windowStartAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : 0;
            const fresh = now - startedAt >= IP_WINDOW_MS;
            const count = fresh ? 0 : Number((_d = d === null || d === void 0 ? void 0 : d.count) !== null && _d !== void 0 ? _d : 0);
            if (count >= IP_MAX_PER_WINDOW) {
                return { allowed: false, retryAfterSeconds: Math.ceil((startedAt + IP_WINDOW_MS - now) / 1000) };
            }
            tx.set(ref, {
                count: count + 1,
                windowStartAt: admin.firestore.Timestamp.fromMillis(fresh ? now : startedAt),
            }, { merge: true });
            return { allowed: true };
        });
    }
    catch (e) {
        // Fail open: a counter we cannot read must not stand between someone and
        // their own account. Logged so a persistent failure is visible.
        console.error('[passwordReset] IP sayacı okunamadı, geçiliyor', e);
        return { allowed: true };
    }
}
/** Advances an address's counter. Never throws — the reset matters more than
 *  perfect bookkeeping. */
async function bumpAddress(ref, sends, now) {
    try {
        await ref.set(Object.assign({ sends: sends + 1, lastAt: admin.firestore.Timestamp.fromMillis(now) }, (sends === 0 ? { firstAt: admin.firestore.Timestamp.fromMillis(now) } : {})), { merge: true });
    }
    catch (e) {
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
exports.requestPasswordReset = (0, https_1.onCall)({ region: 'europe-west1', secrets: [RESEND_API_KEY] }, async (request) => {
    var _a, _b, _c, _d;
    const email = String((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : '').trim().toLowerCase();
    // Shape check only. An address that cannot exist reveals nothing.
    if (!email || !email.includes('@') || email.length > 320) {
        return { ok: true };
    }
    const now = Date.now();
    // IP first: it is the cheap check, and the one guarding the mail quota.
    const ip = (_d = (_c = request.rawRequest) === null || _c === void 0 ? void 0 : _c.ip) !== null && _d !== void 0 ? _d : 'unknown';
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
    }
    catch (e) {
        console.error('[passwordReset] adres sayacı okunamadı, geçiliyor', e);
    }
    let link;
    try {
        link = await admin.auth().generatePasswordResetLink(email);
    }
    catch (e) {
        console.log('[passwordReset] bağlantı üretilemedi (muhtemelen hesap yok)', e.message);
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
    /**
     * An HTML part alongside the text one, because a plain-text mail whose
     * body is mostly a bare URL is a well-known spam signal — the first send
     * from this domain landed in spam. Most of deliverability is DNS and
     * domain reputation (SPF/DKIM/DMARC), not the body, but this is the part
     * that is ours to fix.
     */
    const html = `<!doctype html><html lang="tr"><body style="margin:0;padding:24px;background:#f6f8fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 16px;font-size:20px;font-weight:700">Şifreni sıfırla</p>
<p style="margin:0 0 20px;font-size:15px;line-height:22px">GymEntra hesabının şifresini sıfırlamak için aşağıdaki düğmeye tıkla.</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#10B981;color:#06281F;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px">Şifremi sıfırla</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#6B7280">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>
<p style="margin:0;font-size:13px;line-height:20px;color:#6B7280">Bağlantı bir süre sonra geçersiz olur.</p>
</div>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;color:#9CA3AF;text-align:center">GymEntra</p>
</body></html>`;
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: FROM, to: [email], subject: 'GymEntra — şifre sıfırlama', text, html }),
        });
        if (!res.ok)
            console.error('[passwordReset] Resend reddetti', res.status, await res.text());
    }
    catch (e) {
        console.error('[passwordReset] e-posta gönderilemedi', e);
    }
    // Still `ok` on a send failure: the answer must never vary with anything
    // tied to the address.
    return { ok: true };
});
//# sourceMappingURL=passwordReset.js.map