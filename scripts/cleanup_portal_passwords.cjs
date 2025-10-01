'use strict';

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

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { apply: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') { opts.apply = true; continue; }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  console.log(opts.apply ? 'ÇALIŞTIRMA MODU: portalPassword alanlarını silecek' : 'KURU ÇALIŞTIRMA: portalPassword silinmeyecek');

  // Query all members; filter in app since portalPassword may not be indexed
  const snap = await db.collection('members').get();
  if (snap.empty) {
    console.log('Üye bulunamadı.');
    return;
  }

  let candidates = 0;
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (Object.prototype.hasOwnProperty.call(data, 'portalPassword')) {
      candidates += 1;
      if (opts.apply) {
        await doc.ref.update({ portalPassword: admin.firestore.FieldValue.delete(), passwordResetRequired: true });
        console.log(`SİLİNDİ: members/${doc.id} -> portalPassword kaldırıldı, passwordResetRequired=true ayarlandı`);
        updated += 1;
      } else {
        console.log(`Silinecek (dry-run): members/${doc.id} -> portalPassword mevcut`);
      }
    }
  }

  console.log('\nÖzet:');
  console.log('Aday üye sayısı (portalPassword olan):', candidates);
  console.log('Güncellenen kayıt sayısı:', updated);
}

main().catch((e) => {
  console.error('Hata oluştu:', e);
  process.exit(1);
});
