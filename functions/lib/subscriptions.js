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
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueCatWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
/**
 * RevenueCat webhook → `tenants/{id}.subscription` (P0-1).
 *
 * Why a webhook and not the client: security rules treat `subscription` as
 * server-owned, and rightly so — the free-tier gate reads it, so a client
 * that could write it could grant itself unlimited members. The app tells
 * RevenueCat to buy; RevenueCat verifies the receipt with Apple/Google and
 * tells us. Nothing the phone says is trusted.
 *
 * The gym id travels as RevenueCat's `app_user_id`, so the purchase must be
 * made while logged in as that tenant — the client sets it at purchase time.
 *
 * Authorisation is a shared bearer token configured on both sides. RevenueCat
 * does not sign its webhooks, so this header is the only thing separating a
 * real event from anyone who learns the URL.
 */
const REVENUECAT_WEBHOOK_TOKEN = (0, params_1.defineSecret)('REVENUECAT_WEBHOOK_TOKEN');
/** Event types that mean "this gym is entitled right now". */
const GRANTING = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'PRODUCT_CHANGE',
    'SUBSCRIPTION_EXTENDED',
]);
/**
 * Event types that end entitlement immediately.
 *
 * `CANCELLATION` is deliberately NOT here: a cancelled subscription runs to
 * the end of the period it was paid for, and cutting a gym off the moment
 * they tap cancel would lock them out of members they already paid for.
 * `EXPIRATION` is the event that actually ends it.
 */
const REVOKING = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED', 'REFUND']);
exports.revenueCatWebhook = (0, https_1.onRequest)({ region: 'europe-west1', secrets: [REVENUECAT_WEBHOOK_TOKEN], cors: false }, async (req, res) => {
    var _a, _b, _c, _d, _e;
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const expected = `Bearer ${REVENUECAT_WEBHOOK_TOKEN.value()}`;
    if (req.get('Authorization') !== expected) {
        // Deliberately terse: a detailed error tells a prober what to fix.
        console.warn('RevenueCat webhook: yetkisiz istek reddedildi.');
        res.status(401).send('Unauthorized');
        return;
    }
    const event = (_a = req.body) === null || _a === void 0 ? void 0 : _a.event;
    if (!(event === null || event === void 0 ? void 0 : event.type)) {
        res.status(400).send('Bad Request');
        return;
    }
    const tenantId = String((_b = event.app_user_id) !== null && _b !== void 0 ? _b : '');
    if (!tenantId) {
        console.warn(`RevenueCat webhook: app_user_id yok (${event.type}).`);
        // 200 on purpose: RevenueCat retries non-2xx, and retrying an event we
        // can never route is noise that never drains.
        res.status(200).send('Ignored');
        return;
    }
    const tenantRef = admin.firestore().doc(`tenants/${tenantId}`);
    if (!(await tenantRef.get()).exists) {
        console.warn(`RevenueCat webhook: salon bulunamadı (${tenantId}).`);
        res.status(200).send('Ignored');
        return;
    }
    if (GRANTING.has(event.type)) {
        const expiresAtMs = Number((_c = event.expiration_at_ms) !== null && _c !== void 0 ? _c : 0);
        await tenantRef.update({
            subscription: Object.assign(Object.assign({ status: 'active', plan: String((_d = event.period_type) !== null && _d !== void 0 ? _d : '').toUpperCase() === 'ANNUAL' ? 'yearly' : 'monthly' }, (expiresAtMs ? { expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs) } : {})), { platform: String((_e = event.store) !== null && _e !== void 0 ? _e : '').toUpperCase() === 'PLAY_STORE' ? 'android' : 'ios' }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Abonelik aktif: ${tenantId} (${event.type}).`);
    }
    else if (REVOKING.has(event.type)) {
        await tenantRef.update({
            'subscription.status': event.type === 'REFUND' ? 'cancelled' : 'expired',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Abonelik sona erdi: ${tenantId} (${event.type}).`);
    }
    else {
        // CANCELLATION, BILLING_ISSUE, TRANSFER and the rest: recorded, not acted
        // on. Reacting to an event whose meaning we have not thought through is
        // how a paying gym gets locked out.
        console.log(`RevenueCat olayı işlenmedi: ${event.type} (${tenantId}).`);
    }
    res.status(200).send('OK');
});
//# sourceMappingURL=subscriptions.js.map