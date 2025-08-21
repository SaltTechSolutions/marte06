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
  const opts = { apply: false, memberId: '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') { opts.apply = true; continue; }
    if ((a === '--member' || a === '-m') && i + 1 < args.length) { opts.memberId = String(args[++i]); continue; }
    const mEq = a.match(/^--member=(.+)$/);
    if (mEq) { opts.memberId = String(mEq[1]); continue; }
  }
  return opts;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days - 1);
  return d;
}

async function main() {
  const opts = parseArgs();
  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  console.log(opts.apply ? 'ÇALIŞTIRMA MODU: Uygulama (değişiklikler yapılacak)' : 'KURU ÇALIŞTIRMA: Değişiklik yapılmayacak');
  if (opts.memberId) console.log('Sadece üye için çalıştırılıyor:', opts.memberId);

  // Build a map of packageId -> durationDays
  console.log('Paketler yükleniyor...');
  const pkgSnap = await db.collection('packages').get();
  const durationByPkg = new Map();
  pkgSnap.forEach(doc => {
    const data = doc.data() || {};
    const dd = Number(data.durationDays || 0);
    durationByPkg.set(doc.id, Number.isFinite(dd) ? dd : 0);
  });
  console.log('Paket sayısı:', durationByPkg.size);

  // Load assigned_packages (optionally by member)
  let apQuery = db.collection('assigned_packages');
  if (opts.memberId) apQuery = apQuery.where('memberId', '==', opts.memberId);
  console.log('Atanmış paketler yükleniyor...');
  const apSnap = await apQuery.get();
  if (apSnap.empty) {
    console.log('Atanmış paket bulunamadı.');
    return;
  }

  let total = 0;
  let candidates = 0;
  let updated = 0;

  for (const doc of apSnap.docs) {
    total += 1;
    const data = doc.data() || {};

    const endDate = data.endDate;
    if (endDate && typeof endDate.toDate === 'function') {
      continue; // already has endDate
    }

    const startTs = data.startDate;
    const pkgId = data.packageId;
    const dd = durationByPkg.get(pkgId) || 0;

    if (!startTs || typeof startTs.toDate !== 'function') continue;
    if (!dd || dd <= 0) continue;

    const start = startTs.toDate();
    const end = addDays(start, dd);
    candidates += 1;

    if (opts.apply) {
      await doc.ref.update({ endDate: admin.firestore.Timestamp.fromDate(end) });
      console.log(`GÜNCELLENDİ: assigned_packages/${doc.id} -> endDate=${end.toISOString().slice(0,10)}`);
      updated += 1;
    } else {
      console.log(`Güncellenecek (dry-run): assigned_packages/${doc.id} -> endDate=${end.toISOString().slice(0,10)}`);
    }
  }

  console.log('\nÖzet:');
  console.log('Toplam assigned_packages:', total);
  console.log('Aday (endDate eksik ve durationDays mevcut):', candidates);
  console.log('Güncellenen kayıt sayısı:', updated);
}

main().catch((e) => {
  console.error('Hata oluştu:', e);
  process.exit(1);
});
