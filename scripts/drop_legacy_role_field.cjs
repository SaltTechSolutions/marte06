'use strict';

/**
 * Drops the legacy single `role` field from every `tenant_memberships` doc.
 *
 * A user can hold several roles in one gym, so roles moved to a `roles` array.
 * The old `role` field was kept alongside it for backward compatibility, which
 * left two sources of truth for the same fact — exactly the kind of ambiguity
 * that produced the PKG-8 trainer-list bug (rules read one shape, data carried
 * the other). Every doc now carries `roles`, so `role` is pure redundancy.
 *
 * Verified before writing this: all 58 production docs have BOTH fields and
 * none disagree (`role` is always present in `roles`), so removing `role`
 * loses no information.
 *
 * Safe to re-run: a doc without `role` is skipped.
 *
 * Dry-run by default. `--apply` performs the writes.
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');

function loadServiceAccount() {
  try {
    return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch (e) {
    console.error('Service account yüklenemedi:', SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

async function main() {
  const apply = process.argv.slice(2).includes('--apply');
  const sa = loadServiceAccount();
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  console.log(apply ? 'UYGULAMA MODU — yazımlar yapılacak' : 'KURU ÇALIŞTIRMA — hiçbir şey yazılmayacak');

  const snap = await db.collection('tenant_memberships').get();
  console.log('Toplam kayıt:', snap.size);

  let skipped = 0;
  let cleaned = 0;
  const unsafe = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.role === undefined) {
      skipped += 1;
      continue;
    }
    // Refuse to drop `role` if `roles` cannot stand in for it — better to stop
    // and be told than to silently strip someone's only role.
    if (!Array.isArray(data.roles) || !data.roles.includes(data.role)) {
      unsafe.push([doc.id, data.role, JSON.stringify(data.roles)]);
      continue;
    }
    if (apply) await doc.ref.update({ role: FieldValue.delete() });
    cleaned += 1;
    console.log(`${apply ? 'TEMİZLENDİ' : 'Temizlenecek (dry-run)'}: ${doc.id} (roles=${JSON.stringify(data.roles)})`);
  }

  console.log('\nÖzet:');
  console.log('Atlanan (zaten `role` yok):', skipped);
  console.log(`${apply ? 'Temizlenen' : 'Temizlenecek'}:`, cleaned);
  if (unsafe.length) {
    console.log('\nGÜVENLİ DEĞİL — elle bak (role, roles içinde yok):');
    unsafe.forEach((u) => console.log(' ', u.join(' | ')));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Hata oluştu:', e);
  process.exit(1);
});
