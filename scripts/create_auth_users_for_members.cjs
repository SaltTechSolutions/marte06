'use strict';

// Creates Firebase Auth users for members without memberUid.
// - Generates a random temp password
// - Sets username (defaults to member email)
// - Writes memberUid, username, tempPassword back to members doc
//
// Usage:
//   node scripts/create_auth_users_for_members.cjs [--apply]
//
// Notes:
// - Default is dry-run (no writes). Use --apply to perform updates.
// - Requires service account at scripts/secrets/serviceAccount.json

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');

function loadServiceAccount() {
  try {
    const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Service account yüklenemedi:', SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

function genPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function getUserByEmailSafe(auth, email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user;
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') return null;
    throw e;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();
  const auth = admin.auth();

  console.log(apply ? 'ÇALIŞTIRMA MODU: Uygulama (değişiklikler yapılacak)' : 'KURU ÇALIŞTIRMA: Değişiklik yapılmayacak');

  const membersSnap = await db.collection('members').get();
  let scanned = 0, created = 0, updatedDocs = 0, skipped = 0, noEmail = 0;

  for (const docSnap of membersSnap.docs) {
    scanned += 1;
    const data = docSnap.data() || {};
    const email = (data.email || '').trim().toLowerCase();
    const memberUid = data.memberUid || null;

    if (!email) {
      noEmail += 1;
      console.warn(`Atlanıyor (email yok): members/${docSnap.id}`);
      continue;
    }

    let userRecord = null;
    if (memberUid) {
      // Already linked; ensure username exists; do not override password
      try {
        userRecord = await auth.getUser(memberUid);
      } catch (e) {
        console.warn(`Uyarı: memberUid ile Auth kullanıcısı bulunamadı -> ${memberUid}, members/${docSnap.id}`);
      }
      const patch = {};
      if (!data.username) patch.username = email;
      if (Object.keys(patch).length > 0) {
        if (apply) await docSnap.ref.update({ ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        updatedDocs += 1;
        console.log(`${apply ? 'GÜNCELLENDİ' : 'Güncellenecek (dry-run)'}: members/${docSnap.id} -> ${JSON.stringify(patch)}`);
      } else {
        skipped += 1;
      }
      continue;
    }

    // No memberUid -> create auth user if not exists
    userRecord = await getUserByEmailSafe(auth, email);

    let uid = userRecord?.uid || null;
    let tempPassword = null;

    if (!userRecord) {
      tempPassword = genPassword(12);
      const displayName = [data.name, data.surname].filter(Boolean).join(' ').trim() || undefined;
      if (apply) {
        const createdUser = await auth.createUser({ email, password: tempPassword, displayName, emailVerified: false, disabled: false });
        uid = createdUser.uid;
      } else {
        console.log(`(dry-run) Oluşturulacak kullanıcı: ${email} için yeni Auth kullanıcısı ve temp şifre üretilecek.`);
      }
      created += 1;
    } else {
      console.log(`Mevcut Auth kullanıcısı bulundu: ${email} -> ${uid}`);
    }

    // Write back to members doc
    const patch = {
      memberUid: uid || undefined,
      username: email,
      ...(tempPassword ? { tempPassword } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (apply) await docSnap.ref.update(patch);
    updatedDocs += 1;
    console.log(`${apply ? 'GÜNCELLENDİ' : 'Güncellenecek (dry-run)'}: members/${docSnap.id} -> ${JSON.stringify({ memberUid: patch.memberUid, username: patch.username, tempPassword: tempPassword ? '***' : undefined })}`);
  }

  console.log(`\nÖzet -> Taranan: ${scanned}, oluşturulan Auth: ${created}, güncellenen member dokümanı: ${updatedDocs}, atlanan: ${skipped}, e-postasız: ${noEmail}`);
  console.log('Tamamlandı.');
}

main().catch((err) => {
  console.error('Hata oluştu:', err);
  process.exit(1);
});
