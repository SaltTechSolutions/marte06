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
exports.revenueCatWebhook = exports.respondToGuardian = exports.requestGuardian = exports.cancelPtSession = exports.bookPtSessions = exports.notifyExpiringPackages = exports.cancelPackageAssignment = exports.expirePendingPackageChangeRequests = exports.approvePackageChange = exports.creditRollover = exports.reconcileMirrors = exports.syncTenantNameToMemberships = exports.syncTrainerBusySlots = exports.syncMemberEntitlements = exports.syncPackageAssignmentCount = exports.syncActiveMemberCount = exports.promoteFromClassWaitlist = exports.notifyTrainerOnSessionCancelled = exports.notifyAdminsOnPackageChangeResponse = exports.notifyAdminsOnPaymentNotice = exports.notifyOnPaymentReversed = exports.notifyOnClassCancelled = exports.notifyAdminsOnJoinRequest = exports.notifyAdminsOnMemberLeft = exports.notifyOnPackageChangeRequested = exports.notifyOnProgramAssigned = exports.notifyOnPaymentStatusChange = exports.notifyOnMembershipApproved = exports.removeMemberFromTenant = exports.assignMembershipShortCode = exports.deleteMyAccount = exports.seedAdminClaims = exports.setAdminClaim = void 0;
// Must be the very first import in this file — see instrument.ts's own
// comment for why (Sentry's Firebase auto-instrumentation only works if it
// runs before the modules it instruments are loaded).
require("./instrument");
const admin = __importStar(require("firebase-admin"));
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
var auth_1 = require("./auth");
Object.defineProperty(exports, "setAdminClaim", { enumerable: true, get: function () { return auth_1.setAdminClaim; } });
Object.defineProperty(exports, "seedAdminClaims", { enumerable: true, get: function () { return auth_1.seedAdminClaims; } });
Object.defineProperty(exports, "deleteMyAccount", { enumerable: true, get: function () { return auth_1.deleteMyAccount; } });
Object.defineProperty(exports, "assignMembershipShortCode", { enumerable: true, get: function () { return auth_1.assignMembershipShortCode; } });
Object.defineProperty(exports, "removeMemberFromTenant", { enumerable: true, get: function () { return auth_1.removeMemberFromTenant; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "notifyOnMembershipApproved", { enumerable: true, get: function () { return notifications_1.notifyOnMembershipApproved; } });
Object.defineProperty(exports, "notifyOnPaymentStatusChange", { enumerable: true, get: function () { return notifications_1.notifyOnPaymentStatusChange; } });
Object.defineProperty(exports, "notifyOnProgramAssigned", { enumerable: true, get: function () { return notifications_1.notifyOnProgramAssigned; } });
Object.defineProperty(exports, "notifyOnPackageChangeRequested", { enumerable: true, get: function () { return notifications_1.notifyOnPackageChangeRequested; } });
Object.defineProperty(exports, "notifyAdminsOnMemberLeft", { enumerable: true, get: function () { return notifications_1.notifyAdminsOnMemberLeft; } });
Object.defineProperty(exports, "notifyAdminsOnJoinRequest", { enumerable: true, get: function () { return notifications_1.notifyAdminsOnJoinRequest; } });
Object.defineProperty(exports, "notifyOnClassCancelled", { enumerable: true, get: function () { return notifications_1.notifyOnClassCancelled; } });
Object.defineProperty(exports, "notifyOnPaymentReversed", { enumerable: true, get: function () { return notifications_1.notifyOnPaymentReversed; } });
Object.defineProperty(exports, "notifyAdminsOnPaymentNotice", { enumerable: true, get: function () { return notifications_1.notifyAdminsOnPaymentNotice; } });
Object.defineProperty(exports, "notifyAdminsOnPackageChangeResponse", { enumerable: true, get: function () { return notifications_1.notifyAdminsOnPackageChangeResponse; } });
Object.defineProperty(exports, "notifyTrainerOnSessionCancelled", { enumerable: true, get: function () { return notifications_1.notifyTrainerOnSessionCancelled; } });
var classes_1 = require("./classes");
Object.defineProperty(exports, "promoteFromClassWaitlist", { enumerable: true, get: function () { return classes_1.promoteFromClassWaitlist; } });
var sync_1 = require("./sync");
Object.defineProperty(exports, "syncActiveMemberCount", { enumerable: true, get: function () { return sync_1.syncActiveMemberCount; } });
Object.defineProperty(exports, "syncPackageAssignmentCount", { enumerable: true, get: function () { return sync_1.syncPackageAssignmentCount; } });
Object.defineProperty(exports, "syncMemberEntitlements", { enumerable: true, get: function () { return sync_1.syncMemberEntitlements; } });
Object.defineProperty(exports, "syncTrainerBusySlots", { enumerable: true, get: function () { return sync_1.syncTrainerBusySlots; } });
Object.defineProperty(exports, "syncTenantNameToMemberships", { enumerable: true, get: function () { return sync_1.syncTenantNameToMemberships; } });
Object.defineProperty(exports, "reconcileMirrors", { enumerable: true, get: function () { return sync_1.reconcileMirrors; } });
var packages_1 = require("./packages");
Object.defineProperty(exports, "creditRollover", { enumerable: true, get: function () { return packages_1.creditRollover; } });
Object.defineProperty(exports, "approvePackageChange", { enumerable: true, get: function () { return packages_1.approvePackageChange; } });
Object.defineProperty(exports, "expirePendingPackageChangeRequests", { enumerable: true, get: function () { return packages_1.expirePendingPackageChangeRequests; } });
Object.defineProperty(exports, "cancelPackageAssignment", { enumerable: true, get: function () { return packages_1.cancelPackageAssignment; } });
Object.defineProperty(exports, "notifyExpiringPackages", { enumerable: true, get: function () { return packages_1.notifyExpiringPackages; } });
var sessions_1 = require("./sessions");
Object.defineProperty(exports, "bookPtSessions", { enumerable: true, get: function () { return sessions_1.bookPtSessions; } });
Object.defineProperty(exports, "cancelPtSession", { enumerable: true, get: function () { return sessions_1.cancelPtSession; } });
var guardians_1 = require("./guardians");
Object.defineProperty(exports, "requestGuardian", { enumerable: true, get: function () { return guardians_1.requestGuardian; } });
Object.defineProperty(exports, "respondToGuardian", { enumerable: true, get: function () { return guardians_1.respondToGuardian; } });
var subscriptions_1 = require("./subscriptions");
Object.defineProperty(exports, "revenueCatWebhook", { enumerable: true, get: function () { return subscriptions_1.revenueCatWebhook; } });
//# sourceMappingURL=index.js.map