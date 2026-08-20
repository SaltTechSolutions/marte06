import * as admin from 'firebase-admin';

/**
 * Wipes every document in the emulator's active project namespace. Call
 * from `beforeEach` so tests don't leak fixtures into each other — the
 * same pattern `tests/firestore.rules.test.ts` uses via
 * `testEnv.clearFirestore()`, reimplemented here against the raw emulator
 * REST endpoint since these tests go through the Admin SDK, not
 * `@firebase/rules-unit-testing`.
 */
export async function clearFirestore(): Promise<void> {
  const projectId = admin.app().options.projectId ?? process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('No project id available to scope the emulator wipe to.');
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to clear Firestore emulator: ${res.status} ${await res.text()}`);
}

/** A `Timestamp` `daysFromNow` days from the current moment. */
export function timestampDaysFromNow(days: number): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(Date.now() + days * 86400000);
}
