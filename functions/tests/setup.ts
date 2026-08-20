/**
 * Runs once per test file, before any test body — including before the
 * `FIRESTORE_EMULATOR_HOST` check below runs, since imports are always
 * evaluated first regardless of where they sit textually. That's fine:
 * `admin.initializeApp()` only registers the app object, it never touches
 * Firestore itself — no data is read or written until a test body runs,
 * and by then this file's synchronous throw below has already aborted the
 * whole run if the emulator isn't in front of us.
 *
 * Every other test file can `import { creditRollover } from '../src/packages'`
 * (etc.) directly without separately importing `../src/index` — this is
 * the one place that side effect happens.
 */
import '../src/index';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST is not set — refusing to run functions tests ' +
      'against a real project. Run via `npm run test` from marte06/ (root), ' +
      'which wraps this in `firebase emulators:exec --only firestore`.',
  );
}
