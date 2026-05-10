# Firebase Auth Operations Checklist

This project uses Firebase Custom Claims for permanent admin authorization.

## Console checks after every auth-related deploy

- Authentication > Sign-in method:
  - Email/Password is enabled.
  - Google is enabled if admin Google login is expected.
- Authentication > Settings > Authorized domains includes:
  - `tarabyamarte.web.app`
  - `tarabyamarte.firebaseapp.com`
  - Any production custom domain before it is announced to users.
- Hosting response headers include Auth CSP allowances:
  - `https://accounts.google.com`
  - `https://apis.google.com`
  - `https://www.gstatic.com`
  - `frame-src https://*.firebaseapp.com https://accounts.google.com`

## Admin claim bootstrap

`seedAdminClaims` is a temporary bootstrap callable for the initial admin list in
`functions/src/index.ts`. It exists only to recover from a locked-out Custom
Claims migration.

After all production admin users have `admin: true`:

1. Confirm each admin can log in after a fresh browser session.
2. Prefer `setAdminClaim` for future admin grants.
3. Remove `seedAdminClaims` from exports and deploy functions, or leave it
   blocked behind the hardcoded allowlist until the next cleanup release.

## Password reset verification

Firebase Console password reset sends the email through Firebase Auth templates.
If users do not receive it:

- Check the user's email exists in Authentication.
- Check Auth email templates and sender domain state.
- Check spam/quarantine.
- Generate a reset link from Admin SDK only for diagnosis; do not store reset
  links or temporary passwords in Firestore.
