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
const Sentry = __importStar(require("@sentry/node"));
const https_1 = require("firebase-functions/v2/https");
/**
 * plan-eng-review Faz 2.2. Must be imported FIRST in `index.ts`, before any
 * other import including `firebase-admin` — Sentry's Node SDK auto-
 * instruments Cloud Functions for Firebase (HTTP, background, and event
 * functions all get error capture with no per-handler wrapping needed),
 * but that only works if this runs before the modules it instruments are
 * loaded. See https://docs.sentry.io/platforms/javascript/guides/firebase/
 *
 * No-op if `SENTRY_DSN` isn't set (local emulator runs, CI, a contributor
 * without a DSN) — same guard shape as the mobile app's `Sentry.init`.
 */
// Same policy as `gymentra-mobile/src/data/errors.ts`: a deliberately
// thrown `HttpsError` with one of these codes is expected business-rule
// output (insufficient credit, already responded, ...), not a bug — auto-
// instrumentation captures every thrown error indiscriminately, so this
// filters those back out before they'd otherwise spend the free tier's
// monthly event budget on normal outcomes. `'internal'` is deliberately
// NOT in this set — an internal error is exactly the unexpected-failure
// case this integration exists to catch.
const EXPECTED_HTTPS_ERROR_CODES = new Set(['failed-precondition', 'invalid-argument', 'permission-denied', 'not-found', 'unauthenticated']);
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        // Error capture only — this project doesn't need performance tracing,
        // and GlitchTip's free tier's monthly event budget is better spent on
        // actual failures than on span data for every invocation.
        tracesSampleRate: 0,
        beforeSend(event, hint) {
            const error = hint.originalException;
            if (error instanceof https_1.HttpsError && EXPECTED_HTTPS_ERROR_CODES.has(error.code))
                return null;
            return event;
        },
    });
}
//# sourceMappingURL=instrument.js.map