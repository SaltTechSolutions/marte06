// Must be the very first import in this file — see instrument.ts's own
// comment for why (Sentry's Firebase auto-instrumentation only works if it
// runs before the modules it instruments are loaded).
import './instrument';

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK to interact with Firebase services. Must
// run exactly once, before any module below calls `admin.firestore()` at
// request time — module evaluation order doesn't matter here since no
// module does Firestore work at import time, only inside its exported
// function bodies, which only ever run after every module below has
// finished loading.
admin.initializeApp();

// Pure structural split (plan-eng-review Faz 0.2) — every export below is
// byte-for-byte the same code that used to live in this file, moved into
// domain modules so Faz 1's six fixes (all touching this codebase) land as
// readable diffs instead of overlapping edits to one 1,099-line file. No
// behavior changed; `tests/smoke.test.ts` and `tests/firestore.rules.test.ts`
// both stayed green through the split.
export { setAdminClaim, seedAdminClaims, deleteMyAccount, assignMembershipShortCode } from './auth';
export { notifyOnMembershipApproved, notifyOnPaymentStatusChange, notifyOnProgramAssigned, notifyOnPackageChangeRequested, notifyAdminsOnMemberLeft } from './notifications';
export { promoteFromClassWaitlist } from './classes';
export { syncActiveMemberCount, syncPackageAssignmentCount, syncMemberEntitlements, syncTrainerBusySlots, reconcileMirrors } from './sync';
export { creditRollover, approvePackageChange, expirePendingPackageChangeRequests } from './packages';
export { bookPtSessions, cancelPtSession } from './sessions';
