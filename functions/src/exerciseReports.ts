import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

/**
 * Where reports land. Both are plain config rather than secrets — they are
 * addresses, not credentials, and having them in the repo is what makes it
 * possible to see at a glance where this mail goes.
 *
 * `FROM` must be on a domain verified in Resend, otherwise the send is
 * rejected. Resend's shared `onboarding@resend.dev` works for testing without
 * any domain setup.
 */
const FROM = process.env.EXERCISE_REPORT_FROM ?? 'GymEntra <onboarding@resend.dev>';
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
    const who = r.reportedByName ? `${r.reportedByName} (${r.reportedBy})` : String(r.reportedBy);
    const note = String(r.note ?? '').trim();

    const text = [
      `Hareket: ${r.exerciseName} (${r.exerciseId})`,
      `Sorun:   ${reason}`,
      `Bildiren: ${who}`,
      `Salon:   ${r.tenantId}`,
      '',
      note ? `Not:\n${note}` : 'Not girilmedi.',
      '',
      `Kayıt: exercise_reports/${event.params.reportId}`,
    ].join('\n');

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
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
