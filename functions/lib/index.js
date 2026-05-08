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
exports.createAuthUserOnNewMember = exports.seedAdminClaims = exports.setAdminClaim = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK to interact with Firebase services
admin.initializeApp();
// Admin email list — used ONLY for the initial claim seeding.
// After claims are set, this list is no longer the source of truth.
const ADMIN_EMAILS = [
    'tarabyamarte@gmail.com',
    'tarkan.cicek@gmail.com',
];
/**
 * Callable Cloud Function to set the admin custom claim on a user.
 * Can only be called by an existing admin.
 */
exports.setAdminClaim = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b;
    // Verify the caller is an admin
    if (!((_b = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.admin)) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can grant admin access.');
    }
    const { email, isAdmin } = request.data;
    if (!email || typeof isAdmin !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'email (string) and isAdmin (boolean) are required.');
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: isAdmin });
        return { message: `Admin claim ${isAdmin ? 'granted' : 'revoked'} for ${email}.` };
    }
    catch (error) {
        console.error('Error setting admin claim:', error);
        throw new https_1.HttpsError('internal', 'Failed to set admin claim.');
    }
});
/**
 * One-time callable function to seed admin claims for the initial admin emails.
 * Should be called once during setup, then can be disabled or removed.
 * Can be called by any authenticated user whose email is in the ADMIN_EMAILS list.
 */
exports.seedAdminClaims = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b;
    const callerEmail = (_b = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.email;
    if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
        throw new https_1.HttpsError('permission-denied', 'Only designated admin emails can run the initial seed.');
    }
    const results = [];
    for (const email of ADMIN_EMAILS) {
        try {
            const user = await admin.auth().getUserByEmail(email);
            await admin.auth().setCustomUserClaims(user.uid, { admin: true });
            results.push(`✅ ${email}: admin claim set`);
        }
        catch (e) {
            results.push(`❌ ${email}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return { results };
});
/**
 * A Cloud Function that triggers when a new member is created in Firestore.
 * It creates a corresponding user in Firebase Authentication and updates the
 * member's document with the new auth UID.
 */
exports.createAuthUserOnNewMember = (0, firestore_1.onDocumentCreated)({
    document: 'members/{memberId}',
    region: 'europe-west1',
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log('No data associated with the event');
        return;
    }
    const memberData = snap.data();
    const { memberId } = event.params;
    // Exit if the new member doesn't have an email address
    if (!memberData.email) {
        console.log(`Member ${memberId} has no email, skipping auth user creation.`);
        return;
    }
    try {
        // Check if a user with this email already exists to avoid errors
        const existingUser = await admin.auth().getUserByEmail(memberData.email).catch(() => null);
        if (existingUser) {
            console.log(`User with email ${memberData.email} already exists. Linking UID.`);
            await snap.ref.update({ memberUid: existingUser.uid });
            return;
        }
        // Generate a random password for initial creation (not stored in Firestore)
        const tempPassword = Math.random().toString(36).slice(-12);
        const displayName = `${memberData.name || ''} ${memberData.surname || ''}`.trim();
        // Create the new user in Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: memberData.email,
            password: tempPassword,
            displayName,
            emailVerified: false,
        });
        console.log(`Successfully created auth user: ${userRecord.uid} for member: ${memberId}`);
        // Generate a password reset link for first-time password setup
        try {
            await admin.auth().generatePasswordResetLink(memberData.email);
            console.log(`Password reset link generated for ${memberData.email}.`);
        }
        catch (e) {
            console.warn(`Could not generate password reset link for ${memberData.email}:`, e);
        }
        // Update the member's document with the new UID
        await snap.ref.update({
            memberUid: userRecord.uid,
            passwordResetRequired: true,
        });
    }
    catch (error) {
        console.error(`Error creating auth user for member ${memberId}:`, error);
    }
});
//# sourceMappingURL=index.js.map