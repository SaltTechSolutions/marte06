# Firebase Rules Acceptance Scenarios

Run these with Firebase Emulator Suite before publishing rules changes.

## Firestore

- Unauthenticated users cannot read `members`, `assigned_packages`, `lessons`,
  `payments`, `branches`, or `settings`.
- A user with token `{ admin: true }` can read and write admin collections.
- A member can read their own `members/{memberId}` document when
  `memberUid == auth.uid`.
- A member cannot read another member document.
- A member can read their own assigned packages and lessons when UID fields
  match; they cannot write them.
- A non-admin cannot create, update, or delete `payments`, `branches`,
  `settings`, `packages`, `lessons`, or `assigned_packages`.

## Storage

- Public assets under `settings/{file}` are readable without auth.
- Member files under `members/{uid}/...` are readable by that `uid` or admin.
- Other storage paths are readable and writable only by admins.

## Callable functions

- `setAdminClaim` rejects unauthenticated users and authenticated non-admins.
- `setAdminClaim` accepts only callers whose token has `admin: true`.
- `seedAdminClaims` rejects users outside the bootstrap allowlist.
