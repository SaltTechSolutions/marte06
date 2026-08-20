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
exports.bookPtSessions = exports.expirePendingPackageChangeRequests = exports.applyPackageChange = exports.renewEntitlementCredits = exports.syncTrainerBusySlots = exports.syncMemberEntitlements = exports.syncPackageAssignmentCount = exports.syncActiveMemberCount = exports.promoteFromClassWaitlist = exports.notifyOnPackageChangeRequested = exports.notifyOnProgramAssigned = exports.notifyOnPaymentStatusChange = exports.notifyOnMembershipApproved = exports.assignMembershipShortCode = exports.deleteMyAccount = exports.createAuthUserOnNewMember = exports.seedAdminClaims = exports.setAdminClaim = void 0;
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
Object.defineProperty(exports, "createAuthUserOnNewMember", { enumerable: true, get: function () { return auth_1.createAuthUserOnNewMember; } });
Object.defineProperty(exports, "deleteMyAccount", { enumerable: true, get: function () { return auth_1.deleteMyAccount; } });
Object.defineProperty(exports, "assignMembershipShortCode", { enumerable: true, get: function () { return auth_1.assignMembershipShortCode; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "notifyOnMembershipApproved", { enumerable: true, get: function () { return notifications_1.notifyOnMembershipApproved; } });
Object.defineProperty(exports, "notifyOnPaymentStatusChange", { enumerable: true, get: function () { return notifications_1.notifyOnPaymentStatusChange; } });
Object.defineProperty(exports, "notifyOnProgramAssigned", { enumerable: true, get: function () { return notifications_1.notifyOnProgramAssigned; } });
Object.defineProperty(exports, "notifyOnPackageChangeRequested", { enumerable: true, get: function () { return notifications_1.notifyOnPackageChangeRequested; } });
var classes_1 = require("./classes");
Object.defineProperty(exports, "promoteFromClassWaitlist", { enumerable: true, get: function () { return classes_1.promoteFromClassWaitlist; } });
var sync_1 = require("./sync");
Object.defineProperty(exports, "syncActiveMemberCount", { enumerable: true, get: function () { return sync_1.syncActiveMemberCount; } });
Object.defineProperty(exports, "syncPackageAssignmentCount", { enumerable: true, get: function () { return sync_1.syncPackageAssignmentCount; } });
Object.defineProperty(exports, "syncMemberEntitlements", { enumerable: true, get: function () { return sync_1.syncMemberEntitlements; } });
Object.defineProperty(exports, "syncTrainerBusySlots", { enumerable: true, get: function () { return sync_1.syncTrainerBusySlots; } });
var packages_1 = require("./packages");
Object.defineProperty(exports, "renewEntitlementCredits", { enumerable: true, get: function () { return packages_1.renewEntitlementCredits; } });
Object.defineProperty(exports, "applyPackageChange", { enumerable: true, get: function () { return packages_1.applyPackageChange; } });
Object.defineProperty(exports, "expirePendingPackageChangeRequests", { enumerable: true, get: function () { return packages_1.expirePendingPackageChangeRequests; } });
var sessions_1 = require("./sessions");
Object.defineProperty(exports, "bookPtSessions", { enumerable: true, get: function () { return sessions_1.bookPtSessions; } });
//# sourceMappingURL=index.js.map