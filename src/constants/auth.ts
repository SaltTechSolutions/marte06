// src/constants/auth.ts
// Admin authorization is now managed via Firebase Custom Claims.
// The admin email list is maintained in the Cloud Function (functions/src/index.ts)
// and is only used for the initial claim seeding process.
//
// To grant admin access to a new user:
// 1. Call the `setAdminClaim` Cloud Function with { email, isAdmin: true }
// 2. The user must sign out and sign back in for the claim to take effect
//
// This file is kept for reference but is no longer used for authorization checks.
