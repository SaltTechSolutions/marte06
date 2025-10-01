import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK to interact with Firebase services
admin.initializeApp();

/**
 * A Cloud Function that triggers when a new member is created in Firestore.
 * It creates a corresponding user in Firebase Authentication and updates the
 * member's document with the new auth UID and a temporary password.
 */
export const createAuthUserOnNewMember = onDocumentCreated(
  {
    document: 'members/{memberId}',
    region: 'europe-west1',
  },
  async (event) => {
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

      // Generate a simple random password for initial creation (not stored)
      const tempPassword = Math.random().toString(36).slice(-12);
      const displayName = `${memberData.name || ''} ${memberData.surname || ''}`.trim();

      // Create the new user in Firebase Authentication
      const userRecord = await admin.auth().createUser({
        email: memberData.email,
        password: tempPassword,
        displayName,
        emailVerified: false, // Require verification/password setup
      });

      console.log(`Successfully created auth user: ${userRecord.uid} for member: ${memberId}`);

      // Generate a password reset link for first-time password setup (send via your mail system)
      try {
        await admin.auth().generatePasswordResetLink(memberData.email);
        // Do NOT log the full reset link to avoid leaking sensitive URLs
        console.log(`Password reset link generated for ${memberData.email}.`);
      } catch (e) {
        console.warn(`Could not generate password reset link for ${memberData.email}:`, e);
      }

      // Update the member's document with the new UID and a flag for password setup
      await snap.ref.update({
        memberUid: userRecord.uid,
        passwordResetRequired: true,
      });
    } catch (error) {
      console.error(`Error creating auth user for member ${memberId}:`, error);
    }
  },
);
