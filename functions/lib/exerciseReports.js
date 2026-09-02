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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailExerciseReport = void 0;
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-functions/v2/firestore");
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
/**
 * Where reports land. Plain config rather than secrets — these are addresses,
 * not credentials, and keeping them in the repo is what makes it possible to
 * see at a glance where this mail goes.
 *
 * `salt-tech-apps.com` is the domain verified in Resend; sending from anything
 * else is rejected by the provider.
 */
const FROM = (_a = process.env.EXERCISE_REPORT_FROM) !== null && _a !== void 0 ? _a : 'GymEntra <bildirim@salt-tech-apps.com>';
const TO = (_b = process.env.EXERCISE_REPORT_TO) !== null && _b !== void 0 ? _b : 'tarkan.cicek@gmail.com';
const REASON_LABEL = {
    pose: 'Çizim yanlış',
    muscles: 'Kaslar yanlış',
    text: 'Anlatım yanlış',
    other: 'Başka',
};
/**
 * E-mails a movement-explainer report to whoever maintains the library
 * (PER-19).
 *
 * Without this the feature was only half-built: staff filed a report, the app
 * told them it would be looked at, and it sat in a collection nobody watches.
 * A report that reaches no one is worse than no report button — it collects
 * goodwill and spends it on silence.
 *
 * Deliberately fire-and-forget: the report is ALREADY saved by the time this
 * runs, so a mail provider being down must not look like a failed report. It
 * logs and returns; the document stays as the durable record.
 */
exports.emailExerciseReport = (0, firestore_1.onDocumentCreated)({ document: 'exercise_reports/{reportId}', region: 'europe-west1', secrets: [RESEND_API_KEY] }, async (event) => {
    var _a, _b, _c;
    const r = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!r)
        return;
    const key = RESEND_API_KEY.value();
    if (!key) {
        // The report is safe in Firestore either way; say so loudly rather than
        // failing, so a missing key is a log line and not a lost report.
        console.warn('[exerciseReport] RESEND_API_KEY yok — e-posta atlanıyor, rapor kaydedildi:', event.params.reportId);
        return;
    }
    const reason = (_b = REASON_LABEL[String(r.reason)]) !== null && _b !== void 0 ? _b : String(r.reason);
    const note = String((_c = r.note) !== null && _c !== void 0 ? _c : '').trim();
    /**
     * The report carries a uid, which is not something you can write back to.
     * The membership id is deterministic (`{tenantId}_{uid}`), so one get
     * turns it into a name, an address and the gym's own name — which is what
     * makes the mail answerable ("which frame exactly?") instead of a
     * notification you can only read.
     */
    let reporterEmail;
    let gymName = String(r.tenantId);
    try {
        const snap = await admin
            .firestore()
            .doc(`tenant_memberships/${r.tenantId}_${r.reportedBy}`)
            .get();
        const m = snap.data();
        if (m) {
            reporterEmail = m.userEmail ? String(m.userEmail) : undefined;
            if (m.tenantName)
                gymName = `${m.tenantName} (${r.tenantId})`;
        }
    }
    catch (e) {
        // Cosmetic only — the mail is worth sending without it.
        console.warn('[exerciseReport] bildiren araması başarısız', e);
    }
    const who = [r.reportedByName, reporterEmail].filter(Boolean).join(' · ') || String(r.reportedBy);
    const text = [
        `Hareket:  ${r.exerciseName} (${r.exerciseId})`,
        `Sorun:    ${reason}`,
        `Bildiren: ${who}`,
        `Salon:    ${gymName}`,
        '',
        note ? `Not:\n${note}` : 'Not girilmedi.',
        '',
        `Kayıt: exercise_reports/${event.params.reportId}`,
        'Düzeltme: marte06/scripts/build_exercise_library.py → python3 scripts/build_exercise_library.py',
    ].join('\n');
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign(Object.assign({ from: FROM, to: [TO] }, (reporterEmail ? { reply_to: reporterEmail } : {})), { subject: `GymEntra · ${r.exerciseName} — ${reason}`, text })),
        });
        if (!res.ok) {
            console.error('[exerciseReport] Resend reddetti', res.status, await res.text());
            return;
        }
        console.log('[exerciseReport] e-posta gönderildi:', event.params.reportId);
    }
    catch (e) {
        console.error('[exerciseReport] e-posta gönderilemedi', e);
    }
});
//# sourceMappingURL=exerciseReports.js.map