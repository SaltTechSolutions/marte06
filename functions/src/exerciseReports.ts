import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

/**
 * Where reports land. Plain config rather than secrets — these are addresses,
 * not credentials, and keeping them in the repo is what makes it possible to
 * see at a glance where this mail goes.
 *
 * `salt-tech-apps.com` is the domain verified in Resend; sending from anything
 * else is rejected by the provider.
 */
const FROM = process.env.EXERCISE_REPORT_FROM ?? 'GymEntra <bildirim@salt-tech-apps.com>';
const TO = process.env.EXERCISE_REPORT_TO ?? 'tarkan.cicek@gmail.com';

const REASON_LABEL: Record<string, string> = {
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
export const emailExerciseReport = onDocumentCreated(
  { document: 'exercise_reports/{reportId}', region: 'europe-west1', secrets: [RESEND_API_KEY] },
  async (event) => {
    const r = event.data?.data();
    if (!r) return;

    const key = RESEND_API_KEY.value();
    if (!key) {
      // The report is safe in Firestore either way; say so loudly rather than
      // failing, so a missing key is a log line and not a lost report.
      console.warn('[exerciseReport] RESEND_API_KEY yok — e-posta atlanıyor, rapor kaydedildi:', event.params.reportId);
      return;
    }

    const reason = REASON_LABEL[String(r.reason)] ?? String(r.reason);
    const note = String(r.note ?? '').trim();

    /**
     * The report carries a uid, which is not something you can write back to.
     * The membership id is deterministic (`{tenantId}_{uid}`), so one get
     * turns it into a name, an address and the gym's own name — which is what
     * makes the mail answerable ("which frame exactly?") instead of a
     * notification you can only read.
     */
    let reporterEmail: string | undefined;
    let gymName = String(r.tenantId);
    try {
      const snap = await admin
        .firestore()
        .doc(`tenant_memberships/${r.tenantId}_${r.reportedBy}`)
        .get();
      const m = snap.data();
      if (m) {
        reporterEmail = m.userEmail ? String(m.userEmail) : undefined;
        if (m.tenantName) gymName = `${m.tenantName} (${r.tenantId})`;
      }
    } catch (e) {
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
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          // Answering the mail reaches the person who filed it, not us.
          ...(reporterEmail ? { reply_to: reporterEmail } : {}),
          subject: `GymEntra · ${r.exerciseName} — ${reason}`,
          text,
        }),
      });
      if (!res.ok) {
        console.error('[exerciseReport] Resend reddetti', res.status, await res.text());
        return;
      }
      console.log('[exerciseReport] e-posta gönderildi:', event.params.reportId);
    } catch (e) {
      console.error('[exerciseReport] e-posta gönderilemedi', e);
    }
  },
);
