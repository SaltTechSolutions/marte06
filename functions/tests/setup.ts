/**
 * Runs once per test file, before `src/index.ts` (and therefore
 * `admin.initializeApp()`) is imported anywhere. Its only job is to fail
 * loudly if the emulator isn't actually in front of us — every test in this
 * suite calls real `admin.firestore()` writes, and the one thing worse than
 * a flaky test is one that quietly hits production.
 */
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST is not set — refusing to run functions tests ' +
      'against a real project. Run via `npm run test` from marte06/ (root), ' +
      'which wraps this in `firebase emulators:exec --only firestore`.',
  );
}
