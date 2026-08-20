import { defineConfig } from 'vitest/config';

/**
 * Integration tests against the real Firestore emulator (not mocks) — the
 * whole point per plan-eng-review TR1: sorgu+auto-ID phantom reads, credit
 * double-spend, and package uniqueness only show up under a real
 * transaction, not a stubbed one. Run via `npm run test` from `marte06/`
 * (root), which wraps this in `firebase emulators:exec --only firestore`,
 * the same infrastructure `test:rules` already uses (JDK 21 required).
 *
 * `tests/setup.ts` sets `FIRESTORE_EMULATOR_HOST` before `src/index.ts` is
 * imported, so `admin.initializeApp()` and every `admin.firestore()` call
 * transparently route to the emulator — never production.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Firestore transaction tests intentionally run concurrent writes
    // against the same emulator instance — parallel test files would
    // race each other's fixtures.
    fileParallelism: false,
  },
});
