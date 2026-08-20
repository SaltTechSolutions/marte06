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
exports.sendPushToUser = sendPushToUser;
const admin = __importStar(require("firebase-admin"));
/**
 * Looks up every registered device for a user and pushes to all of them via
 * Expo's push service. Best-effort: a user with no tokens (never opened the
 * app, denied permission, simulator-only) is a silent no-op, not an error.
 */
async function sendPushToUser(userId, title, body, data) {
    var _a;
    const tokensSnap = await admin.firestore().collection('push_tokens').where('userId', '==', userId).get();
    if (tokensSnap.empty)
        return;
    const messages = tokensSnap.docs.map((tokenDoc) => (Object.assign({ to: tokenDoc.id, title,
        body, sound: 'default' }, (data ? { data } : {}))));
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
    });
    const result = (await response.json().catch(() => null));
    console.log(`Push to ${userId} (${messages.length} device(s)):`, JSON.stringify(result));
    // Expo answers per message, in the order we sent them. A DeviceNotRegistered
    // error means the app was uninstalled or the token was revoked — keeping it
    // costs a wasted request on every future push and the row never expires on
    // its own, so drop it here.
    const tickets = (_a = result === null || result === void 0 ? void 0 : result.data) !== null && _a !== void 0 ? _a : [];
    const dead = tickets
        .map((ticket, i) => { var _a; return (((_a = ticket === null || ticket === void 0 ? void 0 : ticket.details) === null || _a === void 0 ? void 0 : _a.error) === 'DeviceNotRegistered' ? tokensSnap.docs[i] : null); })
        .filter((doc) => doc != null);
    if (dead.length > 0) {
        const batch = admin.firestore().batch();
        dead.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Removed ${dead.length} dead push token(s) for ${userId}`);
    }
}
//# sourceMappingURL=push.js.map