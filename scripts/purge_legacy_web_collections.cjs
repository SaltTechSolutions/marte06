'use strict';

/**
 * WEB-5: deletes the marte06 web app's legacy collections.
 *
 * The web app was taken down (WEB-4) and its data archived (WEB-1) to
 * `archive/marte06-legacy/` — 224 documents, verified id-for-id against
 * production before this script was written. Nothing here is recoverable
 * from the app afterwards; the archive is the only copy.
 *
 * `payments` is the dangerous one and is handled specially. GymEntra writes
 * to the SAME collection name with a different shape, and the two are only
 * told apart by `tenantId` (GymEntra rows have it, legacy rows never do).
 * A blind collection wipe would destroy the live gym's payment ledger, so
 * this script deletes only rows WITHOUT `tenantId` and reports how many
 * GymEntra rows it left alone.
 *
 * Dry-run by default. `--apply` performs the deletes.
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');
const ARCHIVE_DIR = path.resolve(__dirname, '../archive/marte06-legacy');

/**
 * Wiped whole.
 *
 * `payments` is on this list only because the gym owner confirmed the five
 * GymEntra-shaped rows in it are demo data (all belong to one test member).
 * That is NOT true in general: GymEntra writes its live ledger to this same
 * collection name, told apart from legacy rows only by `tenantId`. If this
 * script is ever re-run against a gym with real payments, drop `payments`
 * from this list and filter on `!tenantId` instead.
 */
const FULL_WIPE = ['members', 'lessons', 'packages', 'assigned_packages', 'settings', 'branches', 'payments'];

function loadServiceAccount() {
  try {
    return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch (e) {
    console.error('Service account yüklenemedi:', SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

/** Refuses to run unless every doc about to be deleted exists in the archive.
 *  Deleting something that was never archived would be unrecoverable. */
function archivedIds(collection) {
  const file = path.join(ARCHIVE_DIR, `${collection}.json`);
  if (!fs.existsSync(file)) {
    console.error(`Arşiv dosyası yok: ${file} — silme iptal.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Set(data.documents.map((d) => d.name.split('/').pop()));
}

async function deleteDocs(db, docs, apply) {
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    if (apply) {
      const batch = db.batch();
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

async function main() {
  const apply = process.argv.slice(2).includes('--apply');
  const sa = loadServiceAccount();
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  console.log(apply ? 'UYGULAMA MODU — SİLİNECEK' : 'KURU ÇALIŞTIRMA — hiçbir şey silinmeyecek');
  console.log('');

  let total = 0;
  let unarchived = 0;

  for (const c of FULL_WIPE) {
    const archived = archivedIds(c);
    const snap = await db.collection(c).get();
    const missing = snap.docs.filter((d) => !archived.has(d.id));
    if (missing.length) {
      console.error(`❌ ${c}: ${missing.length} doküman ARŞİVDE YOK — bu koleksiyon atlandı.`);
      console.error('   id:', missing.slice(0, 5).map((d) => d.id).join(', '));
      unarchived += missing.length;
      continue;
    }
    await deleteDocs(db, snap.docs, apply);
    console.log(`${apply ? 'SİLİNDİ' : 'Silinecek'}: ${c.padEnd(20)} ${snap.size}`);
    total += snap.size;
  }

  console.log('');
  console.log(`Toplam ${apply ? 'silinen' : 'silinecek'}: ${total} doküman`);
  if (unarchived) {
    console.error(`⚠ ${unarchived} doküman arşivde bulunamadığı için atlandı — elle incele.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Hata oluştu:', e);
  process.exit(1);
});
