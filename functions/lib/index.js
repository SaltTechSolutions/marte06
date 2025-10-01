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
exports.createAuthUserOnNewMember = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK to interact with Firebase services
admin.initializeApp();
/**
 * A Cloud Function that triggers when a new member is created in Firestore.
 * It creates a corresponding user in Firebase Authentication and updates the
 * member's document with the new auth UID and a temporary password.
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
        // Generate a simple random password for the first login
        const tempPassword = Math.random().toString(36).slice(-8);
        const displayName = `${memberData.name || ''} ${memberData.surname || ''}`.trim();
        // Create the new user in Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: memberData.email,
            password: tempPassword,
            displayName,
            emailVerified: true, // Assuming email is valid
        });
        console.log(`Successfully created auth user: ${userRecord.uid} for member: ${memberId}`);
        // Update the member's document with the new UID and temporary password
        await snap.ref.update({
            memberUid: userRecord.uid,
            portalPassword: tempPassword, // Store password for admin to share
        });
    }
    catch (error) {
        console.error(`Error creating auth user for member ${memberId}:`, error);
    }
});
//# sourceMappingURL=index.js.map